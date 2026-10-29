"""Convert OMB Historical Table 1.1 (US_budgets.xlsx) to src/data/us_budgets.csv.

Standard library only. Values are in millions of dollars, by fiscal year.
cum_deficit is the running sum of deficits since 1789 (surpluses subtract),
including the 1789-1900 subtotals and the 1976 transition quarter (TQ).
"""
import csv
import pathlib
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data-src" / "US_budgets.xlsx"
OUT = ROOT / "src" / "data" / "us_budgets.csv"
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def num(x):
    x = x.strip()
    # "*" / "-*" mark amounts of $500 thousand or less.
    return 0.0 if x in ("*", "-*") else float(x)


z = zipfile.ZipFile(SRC)
strings = [
    "".join(t.text or "" for t in si.iter(M + "t"))
    for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")
]
rows = []
for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).find(M + "sheetData"):
    cells = {}
    for c in r:
        v = c.find(M + "v")
        x = v.text if v is not None else ""
        if c.get("t") == "s":
            x = strings[int(x)]
        cells["".join(ch for ch in c.get("r") if ch.isalpha())] = x
    rows.append(cells)

cum = 0.0
with open(OUT, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["year", "receipts", "outlays", "deficit", "cum_deficit"])
    for cells in rows:
        label = cells.get("A", "").strip()
        if not (label[:4].isdigit() or label == "TQ"):
            continue
        receipts, outlays, surplus = num(cells["B"]), num(cells["C"]), num(cells["D"])
        cum += -surplus
        if len(label) == 4 and label.isdigit():
            w.writerow([label, receipts, outlays, -surplus, round(cum)])
print(f"wrote {OUT}")
