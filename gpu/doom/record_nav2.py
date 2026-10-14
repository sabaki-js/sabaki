"""Recorder nav v3 : executor doomLaya + directives scriptées (exit/porte/item).
Boucle calquée sur agent.py ; le "modèle" est une politique gloutonne.
"""
import json, os, sys, time
sys.path.insert(0, "/tmp/doomlaya")
import vizdoom as vzd
import agent as A
from doomlib.mission import map_data, Mission

OUT = "/tmp/sabaki/nav"
os.makedirs(OUT, exist_ok=True)
TICRATE = 35

def direct(action, target=None):
    return {"action": action, "target": target, "weapon": None,
            "decision_id": f"script-{time.time_ns()}", "command": action,
            "expires_tick": 10 ** 12}

def main(episodes=20, seconds=300):
    args = A.Args if hasattr(A, "Args") else None
    game = vzd.DoomGame()
    game.set_doom_game_path(str(__import__("pathlib").Path(vzd.__file__).parent / "freedoom2.wad"))
    game.set_doom_map("MAP01")
    game.set_doom_skill(3)
    game.set_screen_resolution(vzd.ScreenResolution.RES_640X480)
    game.set_screen_format(vzd.ScreenFormat.RGB24)
    game.set_depth_buffer_enabled(True)
    game.set_window_visible(False)
    game.set_available_buttons([
        vzd.Button.MOVE_FORWARD, vzd.Button.MOVE_BACKWARD,
        vzd.Button.MOVE_LEFT, vzd.Button.MOVE_RIGHT, vzd.Button.TURN_LEFT_RIGHT_DELTA,
        vzd.Button.ATTACK, vzd.Button.USE,
    ] + [getattr(vzd.Button, f"SELECT_WEAPON{i}") for i in range(1, 8)])
    game.set_mode(vzd.Mode.PLAYER)
    game.set_sectors_info_enabled(True)
    game.set_labels_buffer_enabled(True)
    game.set_objects_info_enabled(True)
    game.set_render_hud(True)
    game.set_render_crosshair(False)
    game.add_available_game_variable(vzd.GameVariable.HEALTH)
    game.add_available_game_variable(vzd.GameVariable.POSITION_X)
    game.add_available_game_variable(vzd.GameVariable.POSITION_Y)
    game.add_available_game_variable(vzd.GameVariable.ANGLE)
    game.init()
    buttons_n = 14
    rows = []
    for ep in range(episodes):
        game.new_episode()
        game.make_action([0] * buttons_n, 12)
        controller = A.Controller(game.get_state().sectors,
            Mission(map_data(game.get_doom_game_path(), "MAP01", 3)))
        sensors = A.Sensors(controller.mission.data["door_sectors"], controller.mission.data["doors"])
        tick = 0
        tactic = "navigate"
        while not game.is_episode_finished() and tick < seconds * TICRATE:
            try:
                raw, s = sensors.read(game, tick)
            except (TypeError, AttributeError):
                game.make_action([0] * buttons_n, 2)
                tick += 2
                continue
            s["map"] = "MAP01"
            controller.mission.observe(s, raw.sectors)
            controller.observe(s, tick, raw.sectors)
            # machine à états + anti-enlisement (progrès vers la sortie)
            enemies = s.get("enemies", [])
            ex = controller.mission.exit
            import math as _m2
            dd = _m2.hypot(ex['center'][0] - s['x'], ex['center'][1] - s['y']) if ex else 1e9
            last_d = getattr(main, '_last_d', dd)
            main._stuck = getattr(main, '_stuck', 0) + (0 if abs(dd - last_d) > 15 else 1)
            main._last_d = dd
            close = [e for e in enemies if e.get("distance", 1e9) < 400]
            if main._stuck > 6:
                main._stuck = 0
                if s.get("door"):
                    action, tgt = "open_door", None
                else:
                    action, tgt = "explore", None
            elif close:
                e = min(close, key=lambda x: x.get("distance", 1e9))
                action, tgt = "attack", {"id": e.get("id"), "name": e.get("name")}
            elif s.get("door"):
                action, tgt = "open_door", dict(s["door"])
            elif controller.mission.exit:
                action, tgt = "exit", None
            elif s.get("items"):
                it = s["items"][0]
                action, tgt = "pickup", {"id": it.get("id"), "name": it.get("name")}
            else:
                action, tgt = "explore", None
            text = A.state_text(s, tactic, 0.0, [])
            if tick % 7 == 0:
                rows.append({"state": text, "command": action, "map": "MAP01", "ep": ep})
            tactic = action
            if tick % 700 == 0:
                ex = controller.mission.exit
                import math as _m
                dd = _m.hypot(ex['center'][0] - s['x'], ex['center'][1] - s['y']) if ex else -1
                print(f"ep{ep} t{tick}: d_exit={dd:.0f}m pos=({s['x']:.0f},{s['y']:.0f}) hp={s.get('hp', 0):.0f} action={action}", flush=True)
            controller.accept(direct(action, tgt), tick)
            act_out = controller.act(s, tick)
            a, refs = (act_out + ([],))[:2] if isinstance(act_out, tuple) else (act_out, [])
            if tick % 700 == 0:
                print(f"  act refs={refs} a_sum={sum(abs(float(x)) for x in list(a)[:7]):.1f}", flush=True)
            game.make_action(list(a)[:buttons_n] + [0] * max(0, buttons_n - len(a)), 1)
            tick += 1
            if game.is_player_dead():
                break
        won = game.is_episode_finished() and not game.is_player_dead()
        print(f"ep{ep}: {'EXIT' if won else 'timeout/mort'} rows={len(rows)}", flush=True)
        for r in rows:
            if r["ep"] == ep:
                r["won"] = won
    game.close()
    json.dump(rows, open(f"{OUT}/nav_map01.json", "w"))
    print(f"TOTAL {len(rows)} exemples", flush=True)

main()
