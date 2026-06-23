"""Chassis - a shared knowledge log / engineering notebook for robotics teams.

A Flask app: all data, logic, persistence, search, sharing, and PDF generation
live in Python. Pages are server-rendered; in-page actions use HTMX so updates
are server-driven fragments that feel instant on localhost and LAN.
"""

import os
import socket
import calendar as calmod
from datetime import datetime, date, timezone

from flask import (
    Flask, render_template, request, redirect, url_for,
    session, abort, send_file, Response,
)

from chassis import store
from chassis.store import BoardCtx, tag_map
from chassis.search import search_entries
from chassis.text import (
    full_team_name, board_title, doc_type, is_notebook, COMPETITION_CHOICES,
)
from chassis.pdf_export import build_pdf

app = Flask(__name__)
app.secret_key = os.environ.get("CHASSIS_SECRET", "dev-only-not-secret-change-me")

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "db.json")
store.init_db(DATA_PATH)


# --- context resolution ------------------------------------------------------

def real_ctx_or_redirect():
    tid = session.get("team_id")
    if not tid:
        return None
    board = store.get_team(tid)
    if not board:
        session.clear()
        return None
    return BoardCtx(board, is_demo=False)


def board_common(ctx, **extra):
    b = ctx.board
    common = dict(
        ctx=ctx, base=ctx.base, is_demo=ctx.is_demo,
        board=b,
        team_name=full_team_name(b["display_name"], b["team_number"]),
        page_title=board_title(b["competition"]),
        doc=doc_type(b["competition"]),
        competition=b["competition"],
        is_notebook=is_notebook(b["competition"]),
        tag_map=tag_map(b),
    )
    common.update(extra)
    return common


def dual(suffix, name, view, methods=("GET",)):
    """Register a view at both the real and the demo URL space."""
    def real_view(**kw):
        ctx = real_ctx_or_redirect()
        if ctx is None:
            return redirect(url_for("signin"))
        return view(ctx, **kw)

    def demo_view(token, **kw):
        ctx = BoardCtx(store.get_demo(token), is_demo=True, token=token)
        return view(ctx, **kw)

    app.add_url_rule("/board" + suffix, name + "_real", real_view, methods=list(methods))
    app.add_url_rule("/demo/<token>/board" + suffix, name + "_demo", demo_view, methods=list(methods))


# --- filtering helper --------------------------------------------------------

def filtered_entries(ctx):
    b = ctx.board
    vals = request.values  # args (GET) or form (POST with hx-include)
    q = vals.get("q", "")
    status = vals.get("status", "all")
    tag = vals.get("tag", "")
    tm = tag_map(b)
    entries = b["entries"]
    if status in ("solved", "in_progress"):
        entries = [e for e in entries if e["status"] == status]
    if tag:
        entries = [e for e in entries if tag in e.get("tag_ids", [])]
    entries = search_entries(entries, tm, q)
    return entries, q, status, tag


# --- home / auth -------------------------------------------------------------

@app.route("/")
def home():
    ctx = real_ctx_or_redirect()
    team_name = None
    if ctx:
        team_name = full_team_name(ctx.board["display_name"], ctx.board["team_number"])
    return render_template("home.html", logged_in=bool(ctx), team_name=team_name,
                           competitions=COMPETITION_CHOICES)


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        f = request.form
        try:
            board = store.create_team(
                f.get("display_name", "").strip(),
                f.get("team_number", "").strip(),
                f.get("competition", "Other").strip(),
                f.get("password", ""),
            )
            session["team_id"] = board["id"]
            return redirect("/board")
        except ValueError as e:
            return render_template("signup.html", error=str(e), form=f,
                                   competitions=COMPETITION_CHOICES), 400
    return render_template("signup.html", error=None, form={}, competitions=COMPETITION_CHOICES)


@app.route("/signin", methods=["GET", "POST"])
def signin():
    if request.method == "POST":
        f = request.form
        try:
            board = store.authenticate(f.get("team_number", "").strip(), f.get("password", ""))
            session["team_id"] = board["id"]
            return redirect("/board")
        except ValueError as e:
            return render_template("signin.html", error=str(e), form=f), 400
    return render_template("signin.html", error=None, form={})


@app.route("/signout", methods=["POST"])
def signout():
    session.clear()
    return redirect("/")


# --- feed --------------------------------------------------------------------

def view_feed(ctx):
    entries, q, status, tag = filtered_entries(ctx)
    return render_template("feed.html", **board_common(
        ctx, entries=entries, q=q, status=status, active_tag=tag,
        total=len(ctx.board["entries"])))


def view_list(ctx):
    entries, q, status, tag = filtered_entries(ctx)
    return render_template("partials/entry_list.html", **board_common(
        ctx, entries=entries, q=q, status=status, active_tag=tag,
        total=len(ctx.board["entries"])))


def view_new(ctx):
    return render_template("entry_new.html", **board_common(ctx))


def do_create(ctx):
    f = request.form
    store.add_entry(ctx.board, {
        "title": f.get("title", ""),
        "description": f.get("description", ""),
        "tag_ids": f.getlist("tag_ids"),
        "status": f.get("status", "in_progress"),
        "progress": f.get("progress", 0),
        "author": f.get("author", ""),
        "contact_email": f.get("contact_email", "") if f.get("contact_optin") else "",
    })
    ctx.persist()
    return redirect(ctx.base)


def view_entry(ctx, eid):
    e = store._find(ctx.board, "entries", eid)
    if not e:
        abort(404)
    others = [x for x in ctx.board["entries"] if x["id"] != eid]
    linked = [x for x in ctx.board["entries"] if x["id"] in e.get("linked_ids", [])]
    return render_template("entry_detail.html", **board_common(
        ctx, e=e, others=others, linked=linked))


def view_edit(ctx, eid):
    e = store._find(ctx.board, "entries", eid)
    if not e:
        abort(404)
    return render_template("entry_edit.html", **board_common(ctx, e=e))


def do_edit(ctx, eid):
    f = request.form
    store.update_entry(ctx.board, eid, {
        "title": f.get("title", "").strip() or "Untitled",
        "description": f.get("description", "").strip(),
        "tag_ids": f.getlist("tag_ids"),
        "status": f.get("status", "in_progress"),
        "author": f.get("author", "").strip(),
        "contact_email": f.get("contact_email", "").strip() if f.get("contact_optin") else "",
    })
    ctx.persist()
    return redirect(f"{ctx.base}/entry/{eid}")


def do_delete(ctx, eid):
    store.delete_entry(ctx.board, eid)
    ctx.persist()
    return redirect(ctx.base)


def do_status(ctx, eid):
    new_status = request.form.get("status", "solved")
    store.update_entry(ctx.board, eid, {"status": new_status})
    ctx.persist()
    e = store._find(ctx.board, "entries", eid)
    show_check = new_status == "solved"
    return render_template("partials/status_control.html",
                           **board_common(ctx, e=e, show_check=show_check))


def do_progress(ctx, eid):
    try:
        p = max(0, min(100, int(request.form.get("progress", 0))))
    except ValueError:
        p = 0
    patch = {"progress": p}
    if p >= 100:
        patch["status"] = "solved"
    store.update_entry(ctx.board, eid, patch)
    ctx.persist()
    e = store._find(ctx.board, "entries", eid)
    return render_template("partials/status_control.html",
                           **board_common(ctx, e=e, show_check=(e["status"] == "solved")))


def do_pin(ctx, eid):
    e = store._find(ctx.board, "entries", eid)
    if e:
        store.update_entry(ctx.board, eid, {"pinned": not e.get("pinned", False)})
        ctx.persist()
    if request.args.get("view") == "detail":
        e = store._find(ctx.board, "entries", eid)
        return render_template("partials/pin_button.html", **board_common(ctx, e=e))
    return view_list(ctx)


def do_comment(ctx, eid):
    c = store.add_comment(ctx.board, eid, request.form.get("author", ""),
                          request.form.get("text", ""))
    ctx.persist()
    if not c:
        abort(404)
    return render_template("partials/comment.html", c=c)


def do_links(ctx, eid):
    store.update_entry(ctx.board, eid, {"linked_ids": request.form.getlist("linked_ids")})
    ctx.persist()
    return redirect(f"{ctx.base}/entry/{eid}")


# --- stats -------------------------------------------------------------------

def _season_filter(entries, scope):
    if scope != "season":
        return entries
    out = []
    now = datetime.now(timezone.utc)
    for e in entries:
        try:
            created = datetime.fromisoformat(e["created_at"])
        except ValueError:
            continue
        if (now - created).days <= 120:
            out.append(e)
    return out


def _comp_progress(board):
    cd = board["calendar"].get("competition_date")
    if not cd:
        return None
    try:
        end = datetime.fromisoformat(cd + "T00:00:00+00:00")
        start = datetime.fromisoformat(board["created_at"])
    except ValueError:
        return None
    now = datetime.now(timezone.utc)
    total = (end - start).total_seconds()
    if total <= 0:
        return None
    elapsed = (now - start).total_seconds()
    pct = max(0, min(100, round(elapsed / total * 100)))
    days_left = (end.date() - now.date()).days
    return {"pct": pct, "days_left": days_left, "date": cd}


def _category_rows(board, status, scope):
    entries = _season_filter(board["entries"], scope)
    if status in ("solved", "in_progress"):
        entries = [e for e in entries if e["status"] == status]
    tm = tag_map(board)
    counts = {}
    for e in entries:
        for tid in e.get("tag_ids", []):
            counts[tid] = counts.get(tid, 0) + 1
    total = sum(counts.values())
    rows = []
    for tid, n in counts.items():
        if tid in tm:
            rows.append({"tag": tm[tid], "n": n,
                         "pct": round(n / total * 100) if total else 0})
    rows.sort(key=lambda r: r["n"], reverse=True)
    return rows


def view_stats(ctx):
    b = ctx.board
    total = len(b["entries"])
    solved = sum(1 for e in b["entries"] if e["status"] == "solved")
    in_prog = total - solved
    recent = len(_season_filter(b["entries"], "season"))
    solved_pct = round(solved / total * 100) if total else 0
    inprog_pct = 100 - solved_pct if total else 0
    return render_template("stats.html", **board_common(
        ctx, total=total, solved=solved, in_prog=in_prog, recent=recent,
        solved_pct=solved_pct, inprog_pct=inprog_pct, comp=_comp_progress(b),
        rows=_category_rows(b, "all", "all"), status="all", scope="all"))


def view_categories(ctx):
    status = request.args.get("status", "all")
    scope = request.args.get("scope", "all")
    return render_template("partials/categories.html",
                           rows=_category_rows(ctx.board, status, scope),
                           status=status, scope=scope, base=ctx.base)


# --- tags --------------------------------------------------------------------

def view_tags(ctx):
    b = ctx.board
    counts = {}
    for e in b["entries"]:
        for tid in e.get("tag_ids", []):
            counts[tid] = counts.get(tid, 0) + 1
    return render_template("tags.html", **board_common(ctx, counts=counts))


def do_add_tag(ctx):
    name = request.form.get("name", "").strip()
    color = request.form.get("color", "#4F9DFF")
    if name:
        store.add_tag(ctx.board, name, color)
        ctx.persist()
    return render_template("partials/tag_row.html", t=ctx.board["tags"][-1], count=0, base=ctx.base)


def do_update_tag(ctx, tid):
    patch = {}
    if "name" in request.form:
        patch["name"] = request.form["name"].strip()
    if "color" in request.form:
        patch["color"] = request.form["color"]
    store.update_tag(ctx.board, tid, patch)
    ctx.persist()
    return Response(status=204)


def do_delete_tag(ctx, tid):
    store.delete_tag(ctx.board, tid)
    ctx.persist()
    return Response(status=200)


# --- calendar ----------------------------------------------------------------

def _month_dates(year, month):
    cal = calmod.Calendar(firstweekday=6)  # Sunday first
    weeks = cal.monthdatescalendar(year, month)
    return weeks


def view_calendar(ctx):
    b = ctx.board
    today = date.today()
    try:
        ym = request.args.get("month", today.strftime("%Y-%m"))
        year, month = (int(x) for x in ym.split("-"))
    except (ValueError, AttributeError):
        year, month = today.year, today.month
    weeks = _month_dates(year, month)
    prev_m = (month - 1) or 12
    prev_y = year - 1 if month == 1 else year
    next_m = 1 if month == 12 else month + 1
    next_y = year + 1 if month == 12 else year
    return render_template("calendar.html", **board_common(
        ctx, weeks=weeks, month=month, year=year, today=today,
        month_label=date(year, month, 1).strftime("%B %Y"),
        prev_ym=f"{prev_y}-{prev_m:02d}", next_ym=f"{next_y}-{next_m:02d}",
        cur_month=month))


def _render_grid(ctx, year, month):
    weeks = _month_dates(year, month)
    return render_template("partials/cal_grid.html", **board_common(
        ctx, weeks=weeks, month=month, year=year, today=date.today(), cur_month=month))


def do_comp_date(ctx):
    store.set_competition_date(ctx.board, request.form.get("competition_date", "").strip())
    ctx.persist()
    cd = ctx.board["calendar"]["competition_date"]
    msg = f"Competition date set to {cd}." if cd else "Competition date cleared."
    return f'<span class="hint ok">{msg}</span>'


def view_day_form(ctx, ):
    d = request.args.get("date")
    if not d:
        abort(400)
    details = ctx.board["calendar"]["work_days"].get(d, {})
    return render_template("partials/day_form.html", base=ctx.base, date=d,
                           details=details, selected=bool(details))


def do_save_day(ctx):
    d = request.form.get("date")
    action = request.form.get("action", "save")
    if action == "remove":
        store.set_day(ctx.board, d, available=False)
    else:
        store.set_day(ctx.board, d, available=True, details={
            "duration": request.form.get("duration", "").strip(),
            "time": request.form.get("time", "").strip(),
            "timezone": request.form.get("timezone", "").strip(),
            "location": request.form.get("location", "").strip(),
        })
    ctx.persist()
    y, m = int(request.form.get("year")), int(request.form.get("month"))
    return _render_grid(ctx, y, m)


def do_quick(ctx):
    y, m = int(request.form.get("year")), int(request.form.get("month"))
    weeks = _month_dates(y, m)
    dates = [d.strftime("%Y-%m-%d") for wk in weeks for d in wk if d.month == m]
    store.quick_select(ctx.board, dates, request.form.get("action", "all"))
    ctx.persist()
    return _render_grid(ctx, y, m)


# --- export / share ----------------------------------------------------------

def do_export_pdf(ctx):
    entries, q, status, tag = filtered_entries(ctx)
    heading = None
    if q or status != "all" or tag:
        heading = "Filtered entries"
    buf = build_pdf(ctx.board, entries, heading=heading)
    fname = (board_title(ctx.board["competition"]).replace(" ", "-").lower() + ".pdf")
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=fname)


def view_share_info(ctx):
    if ctx.is_demo:
        url_path = f"{ctx.base}"  # demo share points at the demo board itself
        return render_template("partials/share_info.html", is_demo=True, share_path=url_path)
    token = ctx.board["share_token"]
    return render_template("partials/share_info.html", is_demo=False,
                           share_path=f"/share/{token}")


@app.route("/share/<token>")
def public_share(token):
    board = store.get_team_by_share(token)
    if not board:
        abort(404)
    return render_template("share_public.html",
                           board=board, tag_map=tag_map(board),
                           team_name=full_team_name(board["display_name"], board["team_number"]),
                           page_title=board_title(board["competition"]))


# --- register dual routes ----------------------------------------------------

dual("", "feed", view_feed)
dual("/list", "list", view_list)
dual("/new", "new_get", view_new)
dual("/new", "new_post", do_create, methods=["POST"])
dual("/entry/<eid>", "entry", view_entry)
dual("/entry/<eid>/edit", "edit_get", view_edit)
dual("/entry/<eid>/edit", "edit_post", do_edit, methods=["POST"])
dual("/entry/<eid>/delete", "del", do_delete, methods=["POST"])
dual("/entry/<eid>/status", "status", do_status, methods=["POST"])
dual("/entry/<eid>/progress", "progress", do_progress, methods=["POST"])
dual("/entry/<eid>/pin", "pin", do_pin, methods=["POST"])
dual("/entry/<eid>/comment", "comment", do_comment, methods=["POST"])
dual("/entry/<eid>/links", "links", do_links, methods=["POST"])
dual("/stats", "stats", view_stats)
dual("/stats/categories", "categories", view_categories)
dual("/tags", "tags", view_tags)
dual("/tags", "addtag", do_add_tag, methods=["POST"])
dual("/tags/<tid>", "updtag", do_update_tag, methods=["POST"])
dual("/tags/<tid>/delete", "deltag", do_delete_tag, methods=["POST"])
dual("/calendar", "calendar", view_calendar)
dual("/calendar/competition-date", "compdate", do_comp_date, methods=["POST"])
dual("/calendar/day", "dayform", view_day_form)
dual("/calendar/day", "saveday", do_save_day, methods=["POST"])
dual("/calendar/quick", "quick", do_quick, methods=["POST"])
dual("/export.pdf", "export", do_export_pdf)
dual("/share-info", "shareinfo", view_share_info)


@app.route("/healthz")
def healthz():
    return "ok"


def _lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    ip = _lan_ip()
    print("\n  Chassis is running.")
    print(f"    On this computer:   http://localhost:{port}")
    print(f"    On your network:    http://{ip}:{port}")
    print("    (Share that network address with teammates on the same Wi-Fi.)\n")
    app.run(host="0.0.0.0", port=port, debug=True)
