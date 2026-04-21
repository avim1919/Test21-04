"""Generate realistic SQL for airlines, flights, and a static JSON export.

Schema (flights-pg in dev-sandbox):
  airlines(airline_id INT PK, name, code CHAR, country)
  airports(airport_code CHAR PK, name, city, country, timezone)
  flights(flight_id BIGINT PK, flight_number, airline_id, origin, destination,
          scheduled_departure TIMESTAMP, scheduled_arrival TIMESTAMP,
          status, aircraft_type)
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

# Today (matches the project's "today" in this conversation).
TODAY = datetime(2026, 4, 21, 12, 0, 0)

# Real-world airport coordinates (lat, lon) for the 6 existing airports.
AIRPORTS = {
    "JFK": {"name": "John F. Kennedy International", "city": "New York",  "country": "USA",    "tz": "America/New_York",    "lat": 40.6413, "lon": -73.7781},
    "LAX": {"name": "Los Angeles International",     "city": "Los Angeles","country": "USA",    "tz": "America/Los_Angeles", "lat": 33.9416, "lon": -118.4085},
    "LHR": {"name": "Heathrow",                      "city": "London",    "country": "UK",     "tz": "Europe/London",       "lat": 51.4700, "lon": -0.4543},
    "TLV": {"name": "Ben Gurion",                    "city": "Tel Aviv",  "country": "Israel", "tz": "Asia/Jerusalem",      "lat": 32.0114, "lon": 34.8867},
    "FRA": {"name": "Frankfurt International",       "city": "Frankfurt", "country": "Germany","tz": "Europe/Berlin",       "lat": 50.0379, "lon": 8.5622},
    "CDG": {"name": "Charles de Gaulle",             "city": "Paris",     "country": "France", "tz": "Europe/Paris",        "lat": 49.0097, "lon": 2.5479},
}

# Real airlines to add (airline_id 5-11 to avoid clashing with existing 1-4).
NEW_AIRLINES = [
    {"airline_id": 5,  "name": "British Airways",   "code": "BA", "country": "UK"},
    {"airline_id": 6,  "name": "Lufthansa",         "code": "LH", "country": "Germany"},
    {"airline_id": 7,  "name": "Air France",        "code": "AF", "country": "France"},
    {"airline_id": 8,  "name": "American Airlines", "code": "AA", "country": "USA"},
    {"airline_id": 9,  "name": "Delta Air Lines",   "code": "DL", "country": "USA"},
    {"airline_id": 10, "name": "United Airlines",   "code": "UA", "country": "USA"},
    {"airline_id": 11, "name": "El Al",             "code": "LY", "country": "Israel"},
]

# Flight duration (minutes) for each ordered pair. Approximate real block times.
DURATION_MIN = {
    ("JFK","LAX"):370, ("LAX","JFK"):330,
    ("JFK","LHR"):420, ("LHR","JFK"):475,
    ("JFK","FRA"):475, ("FRA","JFK"):555,
    ("JFK","CDG"):435, ("CDG","JFK"):510,
    ("JFK","TLV"):620, ("TLV","JFK"):735,
    ("LAX","LHR"):600, ("LHR","LAX"):680,
    ("LAX","CDG"):640, ("CDG","LAX"):700,
    ("LAX","FRA"):650, ("FRA","LAX"):705,
    ("LHR","TLV"):275, ("TLV","LHR"):320,
    ("LHR","FRA"):95,  ("FRA","LHR"):100,
    ("LHR","CDG"):80,  ("CDG","LHR"):85,
    ("CDG","FRA"):75,  ("FRA","CDG"):75,
    ("CDG","TLV"):275, ("TLV","CDG"):305,
    ("FRA","TLV"):240, ("TLV","FRA"):270,
}

# Airline -> route candidates -> aircraft -> realistic flight numbers.
ROUTES = [
    # BA (5) — London hub
    (5, "BA", "LHR", "JFK", ["B777", "A350"], [117, 175, 179]),
    (5, "BA", "JFK", "LHR", ["B777", "A350"], [114, 172, 178]),
    (5, "BA", "LHR", "LAX", ["B777", "B787"], [269, 283]),
    (5, "BA", "LAX", "LHR", ["B777", "B787"], [268, 282]),
    (5, "BA", "LHR", "TLV", ["B787", "A321"], [165, 163]),
    (5, "BA", "TLV", "LHR", ["B787", "A321"], [164, 162]),
    (5, "BA", "LHR", "FRA", ["A320", "A321"], [902, 906, 910]),
    (5, "BA", "FRA", "LHR", ["A320", "A321"], [903, 907, 911]),
    (5, "BA", "LHR", "CDG", ["A320"], [306, 308, 310]),
    (5, "BA", "CDG", "LHR", ["A320"], [303, 305, 307]),

    # LH (6) — Frankfurt hub
    (6, "LH", "FRA", "JFK", ["A330", "B747"], [400, 404]),
    (6, "LH", "JFK", "FRA", ["A330", "B747"], [401, 405]),
    (6, "LH", "FRA", "LAX", ["A340", "A380"], [452, 456]),
    (6, "LH", "LAX", "FRA", ["A340", "A380"], [453, 457]),
    (6, "LH", "FRA", "TLV", ["A321", "A320"], [686, 690]),
    (6, "LH", "TLV", "FRA", ["A321", "A320"], [687, 691]),
    (6, "LH", "FRA", "LHR", ["A320", "A319"], [900, 904]),
    (6, "LH", "LHR", "FRA", ["A320", "A319"], [901, 905]),
    (6, "LH", "FRA", "CDG", ["A320", "A319"], [1034, 1038]),
    (6, "LH", "CDG", "FRA", ["A320", "A319"], [1035, 1039]),

    # AF (7) — Paris hub
    (7, "AF", "CDG", "JFK", ["A350", "B777"], [6, 8, 10]),
    (7, "AF", "JFK", "CDG", ["A350", "B777"], [7, 9, 11]),
    (7, "AF", "CDG", "LAX", ["B777"], [66, 68]),
    (7, "AF", "LAX", "CDG", ["B777"], [65, 67]),
    (7, "AF", "CDG", "TLV", ["A320", "A321"], [1820, 1892]),
    (7, "AF", "TLV", "CDG", ["A320", "A321"], [1821, 1893]),

    # AA (8) — USA
    (8, "AA", "JFK", "LAX", ["A321", "B738"], [1, 21, 185]),
    (8, "AA", "LAX", "JFK", ["A321", "B738"], [10, 20, 180]),
    (8, "AA", "JFK", "LHR", ["B777"], [100, 104]),
    (8, "AA", "LHR", "JFK", ["B777"], [101, 107]),

    # DL (9) — USA
    (9, "DL", "JFK", "LAX", ["A321", "B763"], [411, 443]),
    (9, "DL", "LAX", "JFK", ["A321", "B763"], [422, 482]),
    (9, "DL", "JFK", "LHR", ["A330", "B767"], [1, 3]),
    (9, "DL", "LHR", "JFK", ["A330", "B767"], [2, 4]),

    # UA (10) — USA
    (10, "UA", "JFK", "LHR", ["B763"], [880, 882]),
    (10, "UA", "LHR", "JFK", ["B763"], [883, 885]),
    (10, "UA", "JFK", "FRA", ["B763"], [960]),
    (10, "UA", "FRA", "JFK", ["B763"], [961]),

    # LY (11) — El Al, TLV hub
    (11, "LY", "TLV", "JFK", ["B789", "B77W"], [1, 3]),
    (11, "LY", "JFK", "TLV", ["B789", "B77W"], [2, 8]),
    (11, "LY", "TLV", "LHR", ["B789", "A321"], [315, 317]),
    (11, "LY", "LHR", "TLV", ["B789", "A321"], [316, 318]),
    (11, "LY", "TLV", "FRA", ["A321", "B738"], [353, 355]),
    (11, "LY", "FRA", "TLV", ["A321", "B738"], [354, 356]),
    (11, "LY", "TLV", "CDG", ["A321", "B789"], [323, 325]),
    (11, "LY", "CDG", "TLV", ["A321", "B789"], [324, 326]),
]


def status_for(departure: datetime, arrival: datetime) -> str:
    """Plausible status given where the flight is vs. 'now'."""
    now = TODAY
    if arrival < now - timedelta(hours=2):
        return random.choices(["LANDED", "CANCELLED"], weights=[95, 5])[0]
    if departure <= now <= arrival:
        return random.choices(["IN_AIR", "DELAYED"], weights=[90, 10])[0]
    diff_h = (departure - now).total_seconds() / 3600
    if -0.5 < diff_h < 0.5:
        return random.choices(["BOARDING", "IN_AIR", "DELAYED"], weights=[55, 30, 15])[0]
    if 0.5 <= diff_h < 2:
        return random.choices(["BOARDING", "SCHEDULED", "DELAYED"], weights=[45, 45, 10])[0]
    if diff_h < -0.5:
        return random.choices(["LANDED", "DELAYED"], weights=[90, 10])[0]
    return random.choices(["SCHEDULED", "DELAYED"], weights=[92, 8])[0]


def build_flights(n: int = 50):
    """Spread n flights across the last 7 days (Apr 14 — Apr 21, 2026)."""
    flights = []
    start = TODAY - timedelta(days=7)
    # Pre-expand route/flight-number combos so each flight is unique-ish.
    pool = []
    for airline_id, code, o, d, aircrafts, numbers in ROUTES:
        for num in numbers:
            pool.append((airline_id, code, o, d, aircrafts, num))
    random.shuffle(pool)

    fid = 20000
    used_signatures = set()
    i = 0
    # Bias the distribution so the map is lively: about a third of flights are
    # currently airborne or imminent, the rest are spread across the past week.
    def sample_dep_offset_min() -> int:
        r = random.random()
        if r < 0.30:
            # Currently airborne: departed 0.5-12 hours ago.
            return 7 * 24 * 60 - random.randint(30, 12 * 60)
        if r < 0.45:
            # About to depart / boarding: next 0-3 hours.
            return 7 * 24 * 60 + random.randint(0, 3 * 60)
        if r < 0.60:
            # Scheduled later today / tomorrow.
            return 7 * 24 * 60 + random.randint(3 * 60, 36 * 60)
        # Earlier in the week.
        return random.randint(0, 6 * 24 * 60)

    while len(flights) < n:
        item = pool[i % len(pool)]
        i += 1
        airline_id, code, o, d, aircrafts, num = item

        offset_min = sample_dep_offset_min()
        dep = start + timedelta(minutes=offset_min)
        dep = dep.replace(second=0, microsecond=0)
        # Snap to :00, :15, :30, :45.
        dep = dep.replace(minute=(dep.minute // 15) * 15)

        sig = (code, num, dep.date())
        if sig in used_signatures:
            continue
        used_signatures.add(sig)

        duration = DURATION_MIN.get((o, d), 180)
        # Small random noise on duration to reflect real variance.
        duration = duration + random.randint(-10, 15)
        arr = dep + timedelta(minutes=duration)

        aircraft = random.choice(aircrafts)
        st = status_for(dep, arr)

        fid += 1
        flights.append({
            "flight_id": fid,
            "flight_number": f"{code}{num}",
            "airline_id": airline_id,
            "origin": o,
            "destination": d,
            "scheduled_departure": dep.strftime("%Y-%m-%d %H:%M:%S"),
            "scheduled_arrival": arr.strftime("%Y-%m-%d %H:%M:%S"),
            "status": st,
            "aircraft_type": aircraft,
        })

    flights.sort(key=lambda f: f["scheduled_departure"])
    return flights


def esc(s: str) -> str:
    return s.replace("'", "''")


def airlines_sql(airlines):
    values = []
    for a in airlines:
        values.append(
            f"({a['airline_id']}, '{esc(a['name'])}', '{a['code']}', '{esc(a['country'])}')"
        )
    return (
        "INSERT INTO airlines (airline_id, name, code, country) VALUES\n  "
        + ",\n  ".join(values)
        + "\nON CONFLICT (airline_id) DO NOTHING"
    )


def flights_sql(flights):
    values = []
    for f in flights:
        values.append(
            "({fid}, '{num}', {aid}, '{o}', '{d}', "
            "TIMESTAMP '{dep}', TIMESTAMP '{arr}', '{st}', '{ac}')".format(
                fid=f["flight_id"],
                num=f["flight_number"],
                aid=f["airline_id"],
                o=f["origin"],
                d=f["destination"],
                dep=f["scheduled_departure"],
                arr=f["scheduled_arrival"],
                st=f["status"],
                ac=f["aircraft_type"],
            )
        )
    return (
        "INSERT INTO flights (flight_id, flight_number, airline_id, origin, destination, "
        "scheduled_departure, scheduled_arrival, status, aircraft_type) VALUES\n  "
        + ",\n  ".join(values)
        + "\nON CONFLICT (flight_id) DO NOTHING"
    )


ORIGINAL_AIRLINES = [
    {"airline_id": 1, "name": "EverSQL Air", "code": "ES", "country": "USA"},
    {"airline_id": 2, "name": "SkyWays",     "code": "SW", "country": "UK"},
    {"airline_id": 3, "name": "BlueCloud",   "code": "BC", "country": "Germany"},
    {"airline_id": 4, "name": "FlyFast",     "code": "FF", "country": "France"},
]

ORIGINAL_FLIGHTS = [
    {"flight_id": 10001, "flight_number": "ES101", "airline_id": 1, "origin": "JFK", "destination": "LAX", "scheduled_departure": "2026-01-13T08:00:00", "scheduled_arrival": "2026-01-13T11:10:00", "status": "SCHEDULED", "aircraft_type": "A320"},
    {"flight_id": 10002, "flight_number": "ES102", "airline_id": 1, "origin": "LAX", "destination": "JFK", "scheduled_departure": "2026-01-13T13:00:00", "scheduled_arrival": "2026-01-13T21:05:00", "status": "SCHEDULED", "aircraft_type": "A320"},
    {"flight_id": 10003, "flight_number": "SW201", "airline_id": 2, "origin": "LHR", "destination": "TLV", "scheduled_departure": "2026-01-13T09:00:00", "scheduled_arrival": "2026-01-13T16:00:00", "status": "BOARDING", "aircraft_type": "B737"},
    {"flight_id": 10004, "flight_number": "BC301", "airline_id": 3, "origin": "FRA", "destination": "JFK", "scheduled_departure": "2026-01-13T10:30:00", "scheduled_arrival": "2026-01-13T14:30:00", "status": "DELAYED", "aircraft_type": "A330"},
    {"flight_id": 10005, "flight_number": "FF401", "airline_id": 4, "origin": "CDG", "destination": "FRA", "scheduled_departure": "2026-01-13T11:00:00", "scheduled_arrival": "2026-01-13T12:30:00", "status": "IN_AIR",   "aircraft_type": "A220"},
    {"flight_id": 10006, "flight_number": "ES103", "airline_id": 1, "origin": "TLV", "destination": "LHR", "scheduled_departure": "2026-01-13T15:00:00", "scheduled_arrival": "2026-01-13T18:30:00", "status": "SCHEDULED", "aircraft_type": "B787"},
]


def write_export_json(flights, out_path: Path):
    """Combine new + original flights into a single JSON payload for the web app."""
    all_airlines = ORIGINAL_AIRLINES + NEW_AIRLINES
    airlines_by_id = {a["airline_id"]: a for a in all_airlines}

    export_flights = []
    for f in ORIGINAL_FLIGHTS + [
        {
            **f,
            "scheduled_departure": f["scheduled_departure"].replace(" ", "T"),
            "scheduled_arrival": f["scheduled_arrival"].replace(" ", "T"),
        }
        for f in flights
    ]:
        a = airlines_by_id.get(f["airline_id"], {})
        export_flights.append({
            **f,
            "airline_name": a.get("name", ""),
            "airline_code": a.get("code", ""),
        })
    export_flights.sort(key=lambda f: f["scheduled_departure"])

    airports_export = [
        {"code": k, **v} for k, v in AIRPORTS.items()
    ]

    payload = {
        "generated_at": TODAY.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "airports": airports_export,
        "airlines": all_airlines,
        "flights": export_flights,
    }
    out_path.write_text(json.dumps(payload, indent=2))


def main():
    out_dir = Path(__file__).parent
    flights = build_flights(50)
    (out_dir / "airlines.sql").write_text(airlines_sql(NEW_AIRLINES) + ";\n")
    (out_dir / "flights.sql").write_text(flights_sql(flights) + ";\n")
    repo_root = out_dir.parent
    web_data = repo_root.parent / "flights-map" / "data" / "flights.json"
    if web_data.parent.exists():
        write_export_json(flights, web_data)
        print(f"Wrote JSON to {web_data}")
    print(f"Wrote {len(flights)} flights to flights.sql")
    print(f"Wrote {len(NEW_AIRLINES)} airlines to airlines.sql")


if __name__ == "__main__":
    main()
