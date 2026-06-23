// seed.js
// -----------------------------------------------------------------------------
// First-run demo content. When a brand-new device opens Chassis, we plant a
// sample team with realistic robotics entries so the board "looks like
// something" immediately instead of being an empty shell. Real teams would
// start empty; this is purely so the prototype is explorable on first load.
// -----------------------------------------------------------------------------

import {
  getTeams,
  createTeam,
  ensureDefaultTags,
  getTags,
  addEntry,
  getEntries,
} from './storage'

const DEMO_TEAM = { name: 'Team 6328 Mechanical Advantage', password: 'demo' }

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export function seedIfEmpty() {
  if (getTeams().length > 0) return

  const team = createTeam(DEMO_TEAM)
  ensureDefaultTags(team.id)
  const tags = getTags(team.id)
  const tagId = (name) => tags.find((t) => t.name === name)?.id || null

  if (getEntries(team.id).length > 0) return

  const seedEntries = [
    {
      title: 'Gearbox slipping under load at high current',
      description:
        'Drivetrain gearbox slips when we push against the wall. Found the set screws on the pinion had backed out. Fix: add a flat to the motor shaft and thread-lock the set screws. Re-torqued to spec and it held through a full match.',
      tagName: 'Mechanical',
      status: 'solved',
      author: 'maya',
      pinned: true,
      contactEmail: 'maya.builds@example.com',
      created: 4,
    },
    {
      title: 'Intake rollers stalling on game pieces',
      description:
        'Compliant wheels gripping unevenly — pieces jam at an angle. Trying softer durometer wheels on the outer pair and spacing them 2mm wider. Still testing.',
      tagName: 'Mechanical',
      status: 'in_progress',
      author: 'dev',
      created: 1,
    },
    {
      title: 'CAN bus dropping the rear motor controller',
      description:
        'Random brownouts on the rear-left controller. Traced to a crimp that looked fine but had a cold joint. Lesson: re-crimp anything that flexes near the drivetrain and add a strain relief loop. Solved after re-terminating both ends.',
      tagName: 'Electrical',
      status: 'solved',
      author: 'priya',
      pinned: true,
      created: 9,
    },
    {
      title: 'Battery voltage sag during auto',
      description:
        'Voltage dips below 7V during the auto routine and the RIO reboots. Suspect we are commanding all mechanisms at once. Plan: stagger the spin-up and add current limits per subsystem.',
      tagName: 'Electrical',
      status: 'in_progress',
      author: 'sam',
      created: 2,
    },
    {
      title: 'PID tuning for the arm — oscillation at setpoint',
      description:
        'Arm overshoots and rings. Brought P down, added a touch of D, and a gravity feedforward term so it holds position with almost no steady-state error. Notes on final gains in the comments.',
      tagName: 'Code',
      status: 'solved',
      author: 'alex',
      created: 6,
    },
    {
      title: 'Vision lag making auto-align jittery',
      description:
        'Pose estimate is ~120ms behind, so the robot hunts. Looking at moving the pipeline to the coprocessor and feeding latency back into the estimator. In progress.',
      tagName: 'Code',
      status: 'in_progress',
      author: 'jordan',
      created: 0,
    },
    {
      title: 'Endgame climb sequence — order of operations',
      description:
        'Worked out the climb that scores most reliably: deploy hooks first, then drive forward 6 inches, THEN retract. Doing it in the other order snags the bumper. Captured here so next season does not relearn it the hard way.',
      tagName: 'Strategy',
      status: 'solved',
      author: 'maya',
      created: 12,
    },
  ]

  // Add oldest first so the "unshift" ordering ends up newest-on-top.
  ;[...seedEntries].reverse().forEach((e) => {
    addEntry(team.id, {
      title: e.title,
      description: e.description,
      tagId: tagId(e.tagName),
      status: e.status,
      author: e.author,
      pinned: !!e.pinned,
      contactEmail: e.contactEmail || '',
      createdAt: daysAgo(e.created),
      updatedAt: daysAgo(e.created),
    })
  })

  // Add a couple of comments to the PID entry to show the "correct over time" idea.
  const entries = getEntries(team.id)
  const pid = entries.find((x) => x.title.startsWith('PID tuning'))
  if (pid) {
    pid.comments = [
      {
        id: 'seed_c1',
        author: 'coach',
        text: 'Final gains: P=2.4, I=0, D=0.15, kG=0.6. Logged on the practice bot.',
        createdAt: daysAgo(5),
      },
      {
        id: 'seed_c2',
        author: 'alex',
        text: 'Bumped D to 0.18 after we added the heavier intake. Smoother now.',
        createdAt: daysAgo(3),
      },
    ]
    // persist the comment edit
    const all = getEntries(team.id).map((x) => (x.id === pid.id ? pid : x))
    localStorage.setItem(`chassis.entries.${team.id}`, JSON.stringify(all))
  }
}

export const DEMO_LOGIN = DEMO_TEAM
