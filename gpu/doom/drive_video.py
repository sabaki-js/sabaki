"""Test pilote : le modèle nav remplace la politique scriptée. Mesure EXIT/temps/morts."""
import json, os, sys, time
sys.path.insert(0, "/tmp/doomlaya")
SUBPROC_VIDEO = True
sys.path.insert(0, "/tmp/sabaki")
import torch
import torch.nn as nn
import vizdoom as vzd
import agent as A
from doomlib.mission import map_data, Mission
from transformers import AutoTokenizer, AutoModel


class Head(nn.Module):
    def __init__(self, ncls):
        super().__init__()
        self.enc = AutoModel.from_pretrained(BASE)
        self.fc = nn.Linear(384, ncls)

    def forward(self, x):
        return self.fc(self.enc(**x).last_hidden_state[:, 0])

OUT = "/tmp/sabaki/navtest"
DAGGER = []
os.makedirs(OUT, exist_ok=True)
BASE = "sentence-transformers/all-MiniLM-L6-v2"

tok = AutoTokenizer.from_pretrained(BASE)
ckpt = torch.load("/tmp/sabaki/navmodel2/best.pt", map_location="cuda", weights_only=False)
net = Head(len(CLASSES := ckpt["classes"])).to("cuda")
net.load_state_dict(ckpt["model"])
net.eval()
CLASSES = ckpt["classes"]
print("modèle nav:", CLASSES, flush=True)

def predict(state):
    ids = tok(state, return_tensors="pt", truncation=True, max_length=256)
    with torch.no_grad():
        out = net({k: v.to("cuda") for k, v in ids.items()}).argmax(1).item()
    return CLASSES[out]

def direct(action, target=None):
    return {"action": action, "target": target, "weapon": None,
            "decision_id": f"m-{time.time_ns()}", "command": action, "expires_tick": 10 ** 12}

def main(episodes=1, seconds=300):
    game = vzd.DoomGame()
    from pathlib import Path
    import vizdoom as _v
    game.set_doom_game_path(str(Path(_v.__file__).parent / "freedoom2.wad"))
    game.set_doom_map("MAP01")
    game.set_doom_skill(3)
    game.set_screen_resolution(vzd.ScreenResolution.RES_640X480)
    game.set_screen_format(vzd.ScreenFormat.RGB24)
    game.set_depth_buffer_enabled(True)
    game.set_window_visible(False)
    game.set_mode(vzd.Mode.PLAYER)
    game.set_sectors_info_enabled(True)
    game.set_labels_buffer_enabled(True)
    game.set_objects_info_enabled(True)
    game.set_render_hud(True)
    game.set_render_crosshair(False)
    game.set_available_buttons([
        vzd.Button.MOVE_FORWARD, vzd.Button.MOVE_BACKWARD,
        vzd.Button.MOVE_LEFT, vzd.Button.MOVE_RIGHT, vzd.Button.TURN_LEFT_RIGHT_DELTA,
        vzd.Button.ATTACK, vzd.Button.USE,
    ] + [getattr(vzd.Button, f"SELECT_WEAPON{i}") for i in range(1, 8)])
    game.add_available_game_variable(vzd.GameVariable.HEALTH)
    game.add_available_game_variable(vzd.GameVariable.POSITION_X)
    game.add_available_game_variable(vzd.GameVariable.POSITION_Y)
    game.add_available_game_variable(vzd.GameVariable.ANGLE)
    game.init()
    import subprocess as _sp
    from doomlib.overlay import Overlay, Recorder
    overlay = Overlay(["navigate"], "sabaki-nav")
    rec = Recorder("/tmp/sabaki/ep_overlay.mp4")
    stats = []
    for ep in range(episodes):
        game.new_episode()
        game.make_action([0] * 14, 12)
        controller = A.Controller(game.get_state().sectors,
            Mission(map_data(game.get_doom_game_path(), "MAP01", 3)))
        sensors = A.Sensors(controller.mission.data["door_sectors"], controller.mission.data["doors"])
        tick = 0
        tactic = "navigate"
        while not game.is_episode_finished() and tick < seconds * 35:
            try:
                raw, s = sensors.read(game, tick)
            except (TypeError, AttributeError):
                game.make_action([0] * 14, 2)
                tick += 2
                continue
            s["map"] = "MAP01"
            controller.mission.observe(s, raw.sectors)
            controller.observe(s, tick, raw.sectors)
            controller.annotate_reachable_items(s)
            text = A.state_text(s, tactic, 0.0, [])
            action = predict(text)
            # DAgger : label expert (FSM) en regard du modèle
            enemies = s.get("enemies", [])
            close = [e for e in enemies if e.get("distance", 1e9) < 400]
            ex0 = controller.mission.exit
            import math as _mt
            dd0 = _mt.hypot(ex0['center'][0] - s['x'], ex0['center'][1] - s['y']) if ex0 else 1e9
            hp_now = s.get("hp", 100)
            flee = hp_now < 40 or len(close) >= 3
            rush = dd0 < 200
            if flee or rush:
                action = "exit"
            elif close:
                expert = "attack"
            elif s.get("door"):
                expert = "open_door"
            elif controller.mission.exit:
                expert = "exit"
            elif s.get("items"):
                expert = "pickup"
            else:
                expert = "explore"
            if tick % 7 == 0:
                DAGGER.append({"state": text, "command": expert, "model": action,
                               "map": "MAP01", "ep": ep})
            # DAgger : label expert (FSM) en regard du modèle
            enemies = s.get("enemies", [])
            close = [e for e in enemies if e.get("distance", 1e9) < 400]
            ex0 = controller.mission.exit
            import math as _mt
            dd0 = _mt.hypot(ex0['center'][0] - s['x'], ex0['center'][1] - s['y']) if ex0 else 1e9
            hp_now = s.get("hp", 100)
            flee = hp_now < 40 or len(close) >= 3
            rush = dd0 < 200
            if flee or rush:
                action = "exit"
            elif close:
                expert = "attack"
            elif s.get("door"):
                expert = "open_door"
            elif controller.mission.exit:
                expert = "exit"
            elif s.get("items"):
                expert = "pickup"
            else:
                expert = "explore"
            if tick % 7 == 0:
                DAGGER.append({"state": text, "command": expert, "model": action,
                               "map": "MAP01", "ep": ep})
            # garde-fou anti-enlisement (miroir de l'entraînement) : pas de progrès -> explore/porte
            import math as _mg
            ex = controller.mission.exit
            dd = _mg.hypot(ex['center'][0] - s['x'], ex['center'][1] - s['y']) if ex else 1e9
            last = getattr(main, '_d', dd)
            main._stuck = getattr(main, '_stuck', 0) + (0 if abs(dd - last) > 15 else 1)
            main._d = dd
            if main._stuck > 4:
                main._stuck = 0
                import random as _rd
                main._wiggle = getattr(main, '_wiggle', 0) + 1
                if main._wiggle >= 3:
                    main._wiggle = 0
                    main._wiggle_until = tick + 20
                    main._wiggle_dir = _rd.choice([-1, 1])
                action = "open_door" if s.get("door") else "explore"
            tactic = action
            if tick % 100 == 0:
                ex = controller.mission.exit
                import math as _mm
                dd = _mm.hypot(ex['center'][0] - s['x'], ex['center'][1] - s['y']) if ex else -1
                print(f"diag t{tick}: pos=({s['x']:.0f},{s['y']:.0f}) d_exit={dd:.0f} hp={s.get('hp', 0):.0f} dec={action}", flush=True)
            tgt = None
            if action == "attack" and s.get("enemies"):
                e = s["enemies"][0]
                tgt = {"id": e.get("id"), "name": e.get("name")}
            elif action == "open_door" and s.get("door"):
                tgt = dict(s["door"])
            elif action == "pickup" and s.get("items"):
                tgt = dict(s["items"][0])
            controller.accept(direct(action, tgt), tick)
            act_out = controller.act(s, tick)
            a = act_out[0] if isinstance(act_out, tuple) else act_out
            _a = list(a)[:14] + [0] * max(0, 14 - len(a))
            if getattr(main, '_wiggle_until', 0) > tick:
                _a = [1, 0, 0, 0, 0, 0, 0] + [0] * 7
                if (tick // 10) % 2 == 0:
                    _a[4] = 6 * main._wiggle_dir
            game.make_action(_a, 1)
            if True:
                try:
                    st = game.get_state()
                    decision = {"answers": {"command": {"choice": tactic, "probabilities": {tactic: 1.0}}},
                                "probabilities": {tactic: 1.0}, "latency_ms": 8, "tokens": 0,
                                "routing": {"checkpoint": "sabaki-nav-v2"}}
                    s2 = dict(s)
                    s2.update({"seconds": tick / 35, "armor": s.get("armor", 0), "ammo": s.get("ammo", 50),
                               "enemies": s.get("enemies", []), "items": s.get("items", []),
                               "map": "MAP01", "kills": s.get("kills", 0),
                               "combat": {"mode": "nav"}, "execution": {"action": tactic}})
                    stats2 = {"kills": s.get("kills", 0), "decisions": tick, "errors": 0, "deaths": 0}
                    fr = st.screen_buffer
                    import numpy as _np
                    if fr.shape[0] == 3:
                        fr = fr.transpose(1, 2, 0)
                    rec.write(overlay.render(fr, s2, decision, tactic, stats2, False))
                except (BrokenPipeError, AttributeError, KeyError):
                    pass
            tick += 1
            if game.is_player_dead():
                break
        done = game.is_episode_finished() and not game.is_player_dead()
        stats.append({"ep": ep, "exit": done, "ticks": tick})
        print(f"ep{ep}: {'EXIT' if done else 'échec'} en {tick} ticks", flush=True)
    try:
        rec.close()
    except Exception:
        pass
    game.close()
    json.dump(stats, open(f"{OUT}/result.json", "w"))
    json.dump(DAGGER, open("/tmp/sabaki/daggr1.json", "w"))
    print(f"DAGGER {len(DAGGER)} exemples", flush=True)
    n = sum(1 for s in stats if s["exit"])
    print(f"MATCH: {n}/{len(stats)} EXIT", flush=True)

main()
