from enum import Enum
from itertools import chain
from os import walk
from typing import NamedTuple, Optional, TypeVar, Union, Generic, cast

import filetype as ft
import json
import os.path as path
import shutil
import sys


OkT, ErrT = TypeVar("R"), TypeVar("E")


class Result(Generic[OkT, ErrT]):
    def unwrap(self) -> OkT:
        if self.ok is True:
            return cast(OkT, self.value)

        raise ValueError("Attempted to unwrap an Err value.")

    def __init__(self, value: Union[OkT, ErrT], ok: bool):
        self.value = value
        self.ok = ok


class Ok(Generic[OkT, ErrT], Result[OkT, ErrT]):
    def __init__(self, value: OkT):
        super().__init__(value, True)


class Err(Generic[OkT, ErrT], Result[OkT, ErrT]):
    def __init__(self, value: ErrT):
        super().__init__(value, False)


Discrepancy = NamedTuple(
    "T", [("file_path", str), ("incorrect", str), ("correct", str)]
)


def examine_file(file_path: str) -> Result[Optional[Discrepancy], str]:
    if not path.isfile(file_path):
        return Err(f'The path "{file_path}" is not a valid file.')

    file_type = ft.guess(file_path)

    if file_type is None:
        return Err(f'Could not determine file type for "{file_path}"')

    file_extension: str = path.splitext(file_path)[1].lower()[1:]

    # Standardize multiple accepted extensions down to a single extension, the
    # one used by the file type library, as it does not recognize alternative
    # extensions, only one extension per file type.

    file_extension = {"jpeg": "jpg", "tiff": "tif"}.get(
        file_extension, file_extension
    )

    # Mismatch between the expected extension for the determined file type,
    # and the actual extension of the file.

    if file_type.extension != file_extension:
        return Ok(
            Discrepancy(
                file_path=file_path,
                incorrect=file_extension,
                correct=file_type.extension,
            )
        )

    # No discrepancy.
    return Ok(None)


def generate_csv_report(
    discrepancies: list[Discrepancy], delimiter=","
) -> Result[list[str], str]:
    if len(discrepancies) == 0:
        return Err("No discrepancies to report.")

    try:
        report: list[str] = [
            f"IncorrectExtension{delimiter}CorrectExtension{delimiter}FilePath",
            *[
                f"{d.incorrect}{delimiter}{d.correct}{delimiter}{d.file_path}"
                for d in discrepancies
            ],
        ]
    except Exception as e:
        return Err(f"Encountered an exception while generating CSV report: {e}")

    return Ok(report)


def generate_json_report(
    discrepancies: list[Discrepancy],
) -> Result[list[dict], str]:
    if len(discrepancies) == 0:
        return Err("No discrepancies to report.")

    try:
        report: list[dict] = [
            {
                "file_path": d.file_path,
                "incorrect": d.incorrect,
                "correct": d.correct,
            }
            for d in discrepancies
        ]
    except Exception as e:
        return Err(
            f"Encountered an exception while generating JSON report: {e}"
        )

    return Ok(report)


def fix_discrepancies(
    discrepancies: list[Discrepancy], what_if: bool = True
) -> Result[None, str]:
    def fix_discrepancy(discrepancy: Discrepancy) -> Result[None, str]:
        try:
            wrong_abs: str = path.abspath(discrepancy.file_path)
            wrong_bas: str = path.basename(wrong_abs)
            wrong_spl: tuple[str, str] = path.split(wrong_abs)
            wrong_nex: str = path.splitext(wrong_bas)[0]

            correct_abs: str = path.join(
                wrong_spl[0], f"{wrong_nex}.{discrepancy.correct}"
            )

            if what_if:
                print(f'Would move "{wrong_abs}" to "{correct_abs}"')
            else:
                try:
                    shutil.move(wrong_abs, correct_abs)
                except Exception as e:
                    return Err(
                        f'Encountered an exception while fixing discrepancy "{discrepancy.file_path}" -> "{discrepancy.correct}": {e}'
                    )
        except OSError as e:
            return Err(
                f"Encountered an exception while fixing discrepancy: {e}"
            )

        return Ok(None)

    for d in discrepancies:
        fix_discrepancy(d)

    # r = map(fix_discrepancy, discrepancies)
    return Ok(None)


# If this isn't faster than glob, I'm going to be very disappointed.
def gather_file_paths(start_path: str) -> Result[list[str], str]:
    return Ok(
        [
            *chain.from_iterable(
                map(
                    lambda x: map(lambda y: path.join(x[0], y), x[2]),
                    walk(start_path),
                )
            )
        ]
    )


HELP: str = """

Usage: python ftaudit.py [OPTIONS]

--------------------------------------------------------------------------------

General Options:
    -h, --help            Show this help message and exit.
    -p, --path            Set the path of the starting directory from which to
                          search from. Default: current directory, '.'

Output:
    -o, --output [FILE]   In addition to stdout, write the report to a file.

    -c, --csv             Writes a CSV report to stdout, rather than plaintext.

    -j, --json            Writes a JSON report to stdout, rather than plaintext.
    -i, --indent          Set the indentation level for JSON output. Default: 4.
                        
--------------------------------------------------------------------------------

Modifying Operations:
    -f, --fix           Automatically fix the file extensions of any files
                        with divergent extensions. Not set by default.

    -w, --what-if       Simulates the effects of the --fix option, but does not
                        actually modify any files. Not set by default.
"""

OutputFormat = Enum("OutputFormat", ("Text", "Json", "CSV"))

if __name__ == "__main__":
    search_start: str = "."
    fixing_enabled: bool = False
    output_format: OutputFormat = OutputFormat.Text
    output_file: Optional[str] = None
    json_indent: int = 4
    what_if: bool = False

    for index, argument in enumerate(sys.argv):
        next_argument: str | None = (
            sys.argv[index + 1] if index + 1 < len(sys.argv) else None
        )

        if argument in ("--help", "-h"):
            print(HELP)
            exit(0)

        elif argument in ("--csv", "-c"):
            output_format = OutputFormat.CSV

        elif argument in ("--json", "-j"):
            output_format = OutputFormat.Json

        elif argument in ("--fix", "-f"):
            fixing_enabled = True

        elif argument in ("--what-if", "-w"):
            what_if = True

        if not isinstance(next_argument, str):
            continue

        if argument in ("--path", "-p"):
            search_start = next_argument

        elif argument in ("--output", "-o"):
            output_file = next_argument

        elif argument in ("--indent", "-i"):
            try:
                json_indent = int(next_argument)
            except ValueError as e:
                print(
                    f'Invalid indent value: "{next_argument}"; must be convertible to an integer.'
                )
                print(f"Exception: {e}")
                exit(1)
            except Exception as e:
                print(
                    f'Unexpected exception when converting "{next_argument}" to an integer: {e}'
                )

    r_file_list: Result[list[str], str] = gather_file_paths(search_start)

    if not r_file_list.ok:
        print(r_file_list.value)
        exit(1)

    file_list: list[str] = r_file_list.unwrap()

    map(lambda fp: examine_file(fp), file_list)

    results = map(lambda fp: examine_file(fp), file_list)

    discrepant_results: list[Discrepancy] = [
        *map(
            Result.unwrap,
            filter(lambda r: r.ok and r.unwrap() is not None, results),
        )
    ]

    output: Optional[str] = None

    if output_format == OutputFormat.Text:
        output = "\n".join(
            [
                f"{r.incorrect} should be {r.correct} for file {r.file_path}"
                for r in discrepant_results
            ]
        )

    elif output_format == OutputFormat.Json:
        json_report = generate_json_report(discrepant_results)

        if json_report.ok:
            output = json.dumps(json_report.unwrap(), indent=json_indent)
        else:
            print(json_report.value)
            exit(1)

    elif output_format == OutputFormat.CSV:
        csv_report = generate_csv_report(discrepant_results)

        if csv_report.ok:
            output = "\n".join(csv_report.unwrap())
        else:
            print(csv_report.value)
            exit(1)

    if output is None:
        print(
            f"No output was generated for format {output_format}. This could be a bug."
        )
        exit(1)

    print(output)

    try:
        if isinstance(output_file, str):
            with open(output_file, "w+") as io:
                io.write(output)
    except Exception as e:
        print(
            f"Encountered an exception while writing to output file {output_file}: {e}"
        )
        exit(1)

    # This should be the very last operation, since it has the ability to modify
    # file names. Keeping it last ensures that any errors will have occurred before
    # this point, minimizing risk for the uncertain (I miss Rust).

    if fixing_enabled:
        fix_discrepancies(discrepant_results, what_if)
