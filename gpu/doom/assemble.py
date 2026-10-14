"""Assemblage two-head MAP01 : vision (turn/shoot au contact) + nav MiniLM (reste).
Éval : EXIT / ticks / morts sur 6 épisodes.
"""
import json, os, sys, time
sys.path.insert(0, "/tmp/doomlaya")
sys.path.insert(0, "/tmp/tdd/src")
import numpy as np
import torch
import vizdoom as vzd
import agent as A
from doomlib.mission import map_data, Mission
from transformers import AutoTokenizer, AutoModel
from tiny_doom_defender.evaluation import build_policy

OUT = "/tmp/sabaki/combined"
os.makedirs(OUT, exist_ok=True)
BASE = "sentence-transformers/all-MiniLM-L6-v2"
RES_W, RES_H = 160, 100

# tête nav (MiniLM v2)
tok = AutoTokenizer.from_pretrained(BASE)
ckpt = torch.load("/tmp/sabaki/navmodel2/best.pt", map_location="cuda", weights_only=False)
from transformers import AutoModel as _AM

class Head(torch.nn.Module):
    def __init__(self, ncls):
        super().__init__()
        self.enc = _AM.from_pretrained(BASE)
        self.fc = torch.nn.Linear(384, ncls)
    def forward(self, x):
        return self.fc(self.enc(**x).last_hidden_state[:, 0])

nav = Head(len(ckpt["classes"])).to("cuda")
nav.load_state_dict(ckpt["model"])
nav.eval()
CLASSES = ckpt["classes"]

def nav_predict(state):
    ids = tok(state, return_tensors="pt", truncation=True, max_length=256)
    with torch.no_grad():
        return CLASSES[nav({k: v.to("cuda") for k, v in ids.items()}).argmax(1).item()]

# tête vision (SFT best)
policy = build_policy("/tmp/sabaki/doom-sft/best", "cuda")
frames = []
prev_action = 6
try:
    from PIL import Image
    def shrink(buf):
        img = Image.fromarray(buf.transpose(1, 2, 0) if buf.shape[0] == 3 else buf)
        return np.asarray(img.resize((RES_W, RES_H))).transpose(2, 0, 1)
except ImportError:
    import torch.nn.functional as F
    def shrink(buf):
        t = torch.from_numpy(buf).float().unsqueeze(0)
        if t.shape[1] != 3:
            t = t.permute(0, 3, 1, 2)
        return F.interpolate(t, size=(RES_H, RES_W), mode="area")[0].byte().numpy()

def vision_act(screen):
    global prev_action
    small = shrink(screen.copy())
    frames.append(small)
    while len(frames) > 3:
        frames.pop(0)
    while len(frames) < 3:
        frames.insert(0, small)
    stack = np.concatenate(frames, axis=0).astype(np.float32) / 255.0
    obs = np.concatenate([stack.ravel(), [prev_action]]).astype(np.float32)
    with torch.no_grad():
        a = policy.get_argmax_action(torch.from_numpy(obs).unsqueeze(0).to("cuda"))[0].cpu().numpy()
    prev_action = int(a[0]) * 2 + int(a[1])
    return int(a[0]), int(a[1])  # turn 0=L,1=none,2=R ; shoot 0/1

def direct(action, target=None):
    return {"action": action, "target": target, "weapon": None,
            "decision_id": f"c-{time.time_ns()}", "command": action, "expires_tick": 10 ** 12}

BTN = [vzd.Button.MOVE_FORWARD, vzd.Button.MOVE_BACKWARD, vzd.Button.MOVE_LEFT,
       vzd.Button.MOVE_RIGHT, vzd.Button.TURN_LEFT_RIGHT_DELTA, vzd.Button.ATTACK,
       vzd.Button.USE] + [getattr(vzd.Button, f"SELECT_WEAPON{i}") for i in range(1, 8)]

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
    game.set_render_hud(False)
    game.set_render_crosshair(False)
    game.set_available_buttons(BTN)
    game.add_available_game_variable(vzd.GameVariable.HEALTH)
    game.add_available_game_variable(vzd.GameVariable.POSITION_X)
    game.add_available_game_variable(vzd.GameVariable.POSITION_Y)
    game.add_available_game_variable(vzd.GameVariable.ANGLE)
    game.init()
    import subprocess
    rec = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '640x480', '-r', '17',
        '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
        '-threads', '2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '/tmp/sabaki/ep1.mp4'], stdin=subprocess.PIPE)
    stats = []
    for ep in range(episodes):
        game.new_episode()
        game.make_action([0] * 14, 12)
        controller = A.Controller(game.get_state().sectors,
            Mission(map_data(game.get_doom_game_path(), "MAP01", 3)))
        sensors = A.Sensors(controller.mission.data["door_sectors"], controller.mission.data["doors"])
        frames.clear()
        global prev_action
        prev_action = 6
        tick, tactic = 0, "navigate"
        stuck, last_d = 0, None
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
            enemies = s.get("enemies", [])
            close = [e for e in enemies if e.get("distance", 1e9) < 400]
            hp_now = s.get("hp", 100)
            ex0 = controller.mission.exit
            import math as _mt
            dd0 = _mt.hypot(ex0['center'][0] - s['x'], ex0['center'][1] - s['y']) if ex0 else 1e9
            flee = hp_now < 40 or len(close) >= 3
            rush_exit = dd0 < 200
            if close and not flee and not rush_exit:
                # TÊTE VISION : turn/shoot depuis les pixels (+ avance)
                st = game.get_state()
                turn, shoot = vision_act(st.screen_buffer)
                a = [0] * 14
                # immobile au combat (la vision a été entraînée sans mouvement) ;
                # repli via le contrôleur si l'ennemi est trop près (<120)
                nearest = min((e.get("distance", 1e9) for e in close), default=1e9)
                a_moving = None
                if nearest < 120:
                    a_moving = [0, 1, 0, 0, 0, 0, 0] + [0] * 7  # recule
                if turn == 0:
                    a[4] = -6
                elif turn == 2:
                    a[4] = 6
                if shoot == 1:
                    a[5] = 1
                game.make_action(a_moving if a_moving else a, 2)
                tactic = "attack"
            else:
                if flee or rush_exit:
                    action = "exit"
                else:
                    action = nav_predict(text)
                import math as _m
                ex = controller.mission.exit
                dd = _m.hypot(ex["center"][0] - s["x"], ex["center"][1] - s["y"]) if ex else 1e9
                stuck = stuck + (0 if last_d is not None and abs(dd - last_d) > 15 else 1)
                last_d = dd
                if stuck > 4:
                    stuck = 0
                    action = "open_door" if s.get("door") else "explore"
                tactic = action
                tgt = None
                if action == "open_door" and s.get("door"):
                    tgt = dict(s["door"])
                elif action == "pickup" and s.get("items"):
                    tgt = dict(s["items"][0])
                controller.accept(direct(action, tgt), tick)
                act_out = controller.act(s, tick)
                a = act_out[0] if isinstance(act_out, tuple) else act_out
                game.make_action(list(a)[:14] + [0] * max(0, 14 - len(a)), 1)
            if tick % 200 == 0:
                import math as _m3
                ex3 = controller.mission.exit
                dd3 = _m3.hypot(ex3['center'][0] - s['x'], ex3['center'][1] - s['y']) if ex3 else -1
                print(f"ep{ep} t{tick}: pos=({s['x']:.0f},{s['y']:.0f}) d_exit={dd3:.0f} hp={s.get('hp', 0):.0f} head={'vision' if close else 'nav'}", flush=True)
            if tick % 2 == 0:
                try:
                    fr = game.get_state().screen_buffer
                    import numpy as _np
                    if fr.shape[0] == 3:
                        fr = fr.transpose(1, 2, 0)
                    rec.stdin.write(fr.astype(_np.uint8).tobytes())
                except (BrokenPipeError, AttributeError):
                    pass
            tick += 1
            if game.is_player_dead():
                break
        done = game.is_episode_finished() and not game.is_player_dead()
        stats.append({"ep": ep, "exit": done, "ticks": tick})
        print(f"ep{ep}: {'EXIT' if done else 'échec'} en {tick} ticks", flush=True)
    try:
        rec.stdin.close(); rec.wait(timeout=60)
    except Exception:
        pass
    game.close()
    json.dump(stats, open(f"{OUT}/result.json", "w"))
    print(f"COMBINED: {sum(1 for s in stats if s['exit'])}/{len(stats)} EXIT", flush=True)

main()
