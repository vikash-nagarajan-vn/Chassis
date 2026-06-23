"""Seed data for demo boards.

Kept separate from store.py so the demo content reads as content, not logic.
build_demo_board takes the id, tag, and timestamp helpers from store.py rather
than importing them, which avoids a circular import and keeps this module free
of any persistence concern. The team here, Iron Claws Team 6328, and its six
entries match the FRC scenario in the project brief.
"""

# Tags this demo board ships with. We define them here so the seeded entries
# can reference tags by name and have the builder wire up the ids.
_DEMO_TAGS = [
    {"name": "Drivetrain", "color": "#e8650a"},
    {"name": "Software", "color": "#4f9dde"},
    {"name": "Mechanism Design", "color": "#9b59b6"},
    {"name": "Electrical", "color": "#e0c020"},
    {"name": "Chassis", "color": "#5fb878"},
    {"name": "Strategy", "color": "#d4566f"},
]

# Each entry lists its tags by name. The builder resolves names to ids once the
# tag objects exist. Descriptions use hyphens, never em dashes, per the brief.
_DEMO_ENTRIES = [
    {
        "title": "Gearbox Slipping Under Load",
        "status": "Solved",
        "tags": ["Drivetrain"],
        "pinned": True,
        "author": "Marcus T.",
        "description": (
            "Under high-torque conditions on the ramp, the gearbox output shaft "
            "slips against the wheel hub. Tightened the set screw and added a key "
            "slot. Problem resolved after two test cycles."
        ),
    },
    {
        "title": "Arm PID Tuning Notes",
        "status": "In Progress",
        "tags": ["Software"],
        "pinned": False,
        "author": "Priya S.",
        "description": (
            "Proportional gain is too high at 0.8 - arm oscillates past the target "
            "angle by roughly 12 degrees. Reducing to 0.4 and adding a small "
            "derivative term. Need another practice session to confirm stability."
        ),
    },
    {
        "title": "Intake Roller Width Decision",
        "status": "Solved",
        "tags": ["Mechanism Design"],
        "pinned": False,
        "author": "Jordan L.",
        "description": (
            "Tested 4-inch vs. 6-inch roller width for game piece acquisition. The "
            "6-inch roller had a 30% higher success rate on off-center approaches. "
            "Finalized at 6 inches and updated the CAD model."
        ),
    },
    {
        "title": "Vision Target Alignment Bug",
        "status": "Open",
        "tags": ["Software"],
        "pinned": False,
        "author": "Priya S.",
        "description": (
            "The vision pipeline loses the retroreflective target when ambient "
            "light exceeds a certain threshold. Happens near the field lighting "
            "rigs. Need to narrow the HSV filter range or add an exposure lock."
        ),
    },
    {
        "title": "Battery Voltage Drop During Climb",
        "status": "In Progress",
        "tags": ["Electrical"],
        "pinned": False,
        "author": "Marcus T.",
        "description": (
            "Voltage drops from 12.4V to 10.1V during the 3-second climb sequence, "
            "causing the RoboRIO to brown out. Checking cable gauge and connector "
            "crimps. May need to stagger motor spin-up timing."
        ),
    },
    {
        "title": "Bumper Mounting Revised for Rigidity",
        "status": "Solved",
        "tags": ["Chassis"],
        "pinned": False,
        "author": "Jordan L.",
        "description": (
            "Original L-bracket mounting allowed 5mm of flex under defense contact. "
            "Added a second bracket at the midpoint of each bumper segment. "
            "Post-revision flex is under 1mm and within spec."
        ),
    },
]


def build_demo_board(make_tag, new_id, now):
    """Assemble a fresh demo board dict.

    Parameters are the helper callables from store.py:
      make_tag(name, color) -> a tag dict with an id
      new_id() -> a short id string
      now() -> an ISO timestamp string

    Passing them in keeps this module decoupled from store's internals while
    still producing records in the exact shape store expects.
    """
    tags = [make_tag(t["name"], t["color"]) for t in _DEMO_TAGS]
    name_to_id = {tag["name"]: tag["id"] for tag in tags}

    entries = []
    for spec in _DEMO_ENTRIES:
        entries.append({
            "id": new_id(),
            "title": spec["title"],
            "description": spec["description"],
            "tag_ids": [name_to_id[name] for name in spec["tags"]],
            "status": spec["status"],
            "author": spec["author"],
            "pinned": spec["pinned"],
            "comments": [],
            "related_ids": [],
            "created_at": now(),
            "updated_at": now(),
        })

    return {
        "display_name": "Iron Claws",
        "team_number": "6328",
        "competition": "FRC",
        "entries": entries,
        "tags": tags,
        "calendar": {"competition_date": None, "work_days": {}},
    }
