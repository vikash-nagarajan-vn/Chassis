"""Seed content for a fresh demo board.

Realistic FRC-flavored entries so the demo looks alive the moment a tab opens.
Kept separate from store.py to avoid an import cycle.
"""

from datetime import datetime, timezone, timedelta


def _days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def seed_demo_board(new_board, default_tags_fn, uid, now):
    board = new_board("Circuit Breakers", "6328", "FRC", password=None)

    tags = {t["name"]: t["id"] for t in board["tags"]}

    raw = [
        dict(title="Gearbox slipping under load",
             desc="Drivetrain gearbox slipped when pushing against the wall. The set screws "
                  "on the pinion had backed out. Fix: add a flat to the motor shaft and "
                  "thread-lock the set screws. Re-torqued to spec and it held a full match.",
             tagn=["Mechanical"], status="solved", author="maya", pinned=True,
             email="maya.builds@example.com", days=4, progress=100),
        dict(title="Intake rollers stalling on game pieces",
             desc="Compliant wheels grip unevenly and pieces jam at an angle. Trying softer "
                  "durometer wheels on the outer pair, spaced 2mm wider. Still testing.",
             tagn=["Mechanical"], status="in_progress", author="dev", days=1, progress=40),
        dict(title="CAN bus dropping the rear motor controller",
             desc="Random brownouts on the rear-left controller traced to a cold crimp near "
                  "the drivetrain. Re-terminated both ends and added a strain relief loop.",
             tagn=["Electrical"], status="solved", author="priya", pinned=True, days=9, progress=100),
        dict(title="Battery voltage sag during auto",
             desc="Voltage dips below 7V during auto and the controller reboots. Plan: stagger "
                  "the spin-up and add per-subsystem current limits.",
             tagn=["Electrical", "Programming"], status="in_progress", author="sam", days=2, progress=25),
        dict(title="PID tuning for the arm",
             desc="Arm overshoots and rings at the setpoint. Lowered P, added a little D, and a "
                  "gravity feedforward term so it holds position with almost no steady error.",
             tagn=["Programming"], status="solved", author="alex", days=6, progress=100),
        dict(title="Vision lag makes auto-align jittery",
             desc="Pose estimate is about 120ms behind so the robot hunts. Moving the pipeline "
                  "to the coprocessor and feeding latency back into the estimator.",
             tagn=["Programming", "Strategy"], status="in_progress", author="jordan", days=0, progress=55),
        dict(title="Endgame climb sequence",
             desc="Most reliable climb: deploy hooks, drive forward six inches, then retract. "
                  "Doing it in the other order snags the bumper. Captured so next season keeps it.",
             tagn=["Strategy"], status="solved", author="maya", days=12, progress=100),
    ]

    # Insert oldest first so newest ends up on top.
    for r in reversed(raw):
        entry = {
            "id": uid("entry"),
            "title": r["title"],
            "description": r["desc"],
            "tag_ids": [tags[n] for n in r["tagn"] if n in tags],
            "status": r["status"],
            "progress": r["progress"],
            "author": r["author"],
            "contact_email": r.get("email", ""),
            "pinned": r.get("pinned", False),
            "linked_ids": [],
            "comments": [],
            "created_at": _days_ago(r["days"]),
            "updated_at": _days_ago(r["days"]),
        }
        board["entries"].insert(0, entry)

    # A couple of comments on the PID entry to show "corrected over time".
    for e in board["entries"]:
        if e["title"].startswith("PID"):
            e["comments"] = [
                {"id": uid("cmt"), "author": "coach",
                 "text": "Final gains: P=2.4, D=0.15, kG=0.6. Logged on the practice bot.",
                 "created_at": _days_ago(5)},
                {"id": uid("cmt"), "author": "alex",
                 "text": "Bumped D to 0.18 after the heavier intake went on. Smoother now.",
                 "created_at": _days_ago(3)},
            ]

    # A competition date and a few work days so the calendar and stats are populated.
    comp_date = (datetime.now(timezone.utc) + timedelta(days=45)).strftime("%Y-%m-%d")
    board["calendar"]["competition_date"] = comp_date
    for offset in (1, 3, 6, 8):
        d = (datetime.now(timezone.utc) + timedelta(days=offset)).strftime("%Y-%m-%d")
        board["calendar"]["work_days"][d] = {
            "duration": "120", "time": "16:00",
            "timezone": "America/New_York", "location": "School robotics lab",
        }
    return board
