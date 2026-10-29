"""Build src/data/us_budgets.csv from the files in data-src/.

- US_budgets.xlsx: OMB Historical Table 1.1 (receipts, outlays, deficit), FY1789-2025.
- FYOINT.csv: FRED federal outlays for interest, $ millions, FY1940+.
- FYOIGDA188S.xlsx: FRED federal interest outlays as % of GDP, FY1940+.

Standard library only. Dollar values are in millions, by fiscal year.
cum_deficit is the running sum of deficits since 1789 (surpluses subtract),
including the 1789-1900 subtotals and the 1976 transition quarter (TQ).
gdp is implied by the two FRED series: interest / (interest % of GDP).
Interest columns are blank before FY1940.
"""
import csv
import datetime
import pathlib
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data-src" / "US_budgets.xlsx"
INTEREST = ROOT / "data-src" / "FYOINT.csv"
INTEREST_PCT = ROOT / "data-src" / "FYOIGDA188S.xlsx"
OUT = ROOT / "src" / "data" / "us_budgets.csv"
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def num(x):
    x = x.strip()
    # "*" / "-*" mark amounts of $500 thousand or less.
    return 0.0 if x in ("*", "-*") else float(x)


def read_sheet(path, sheet):
    z = zipfile.ZipFile(path)
    strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        strings = [
            "".join(t.text or "" for t in si.iter(M + "t"))
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")
        ]
    out = []
    for r in ET.fromstring(z.read(f"xl/worksheets/{sheet}.xml")).find(M + "sheetData"):
        cells = {}
        for c in r:
            v = c.find(M + "v")
            x = v.text if v is not None else ""
            if c.get("t") == "s":
                x = strings[int(x)]
            cells["".join(ch for ch in c.get("r") if ch.isalpha())] = x
        out.append(cells)
    return out


rows = read_sheet(SRC, "sheet1")

interest = {}
with open(INTEREST) as f:
    for r in csv.DictReader(f):
        interest[int(r["observation_date"][:4])] = float(r["FYOINT"])

# FRED's xlsx export: sheet2 ("Annual") has Excel serial dates in A and values in B.
interest_pct = {}
for cells in read_sheet(INTEREST_PCT, "sheet2")[1:]:
    if cells.get("A") and cells.get("B"):
        year = (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(cells["A"])))).year
        interest_pct[year] = float(cells["B"])

cum = 0.0
with open(OUT, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["year", "receipts", "outlays", "deficit", "cum_deficit", "interest", "interest_pct_gdp", "gdp"])
    for cells in rows:
        label = cells.get("A", "").strip()
        if not (label[:4].isdigit() or label == "TQ"):
            continue
        receipts, outlays, surplus = num(cells["B"]), num(cells["C"]), num(cells["D"])
        cum += -surplus
        if len(label) == 4 and label.isdigit():
            y = int(label)
            if y in interest and y in interest_pct:
                extra = [round(interest[y], 1), round(interest_pct[y], 4), round(interest[y] / (interest_pct[y] / 100))]
            else:
                extra = ["", "", ""]
            w.writerow([label, receipts, outlays, -surplus, round(cum), *extra])
print(f"wrote {OUT}")
