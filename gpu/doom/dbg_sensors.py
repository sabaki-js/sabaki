import sys
sys.path.insert(0, "/tmp/doomlaya")
import vizdoom as vzd
import agent as A
from doomlib.mission import map_data, Mission
from pathlib import Path
import vizdoom as _v

game = vzd.DoomGame()
game.set_doom_game_path(str(Path(_v.__file__).parent / "freedoom2.wad"))
game.set_doom_map("MAP01")
game.set_doom_skill(3)
game.set_screen_resolution(vzd.ScreenResolution.RES_160X120)
game.set_window_visible(False)
game.set_mode(vzd.Mode.PLAYER)
game.set_sectors_info_enabled(True)
game.set_labels_buffer_enabled(True)
game.set_render_hud(False)
game.set_render_crosshair(False)
game.add_available_game_variable(vzd.GameVariable.HEALTH)
game.init()
game.make_action([0] * 14, 12)
s = game.get_state()
print("objects:", None if s.objects is None else len(s.objects),
      "| labels:", None if s.labels is None else len(s.labels))
controller = A.Controller(s.sectors, Mission(map_data(game.get_doom_game_path(), "MAP01", 3)))
sensors = A.Sensors(controller.mission.data["door_sectors"], controller.mission.data["doors"])
try:
    raw, st = sensors.read(game, 0)
    print("read OK, nkeys:", len(st))
except Exception:
    import traceback
    traceback.print_exc()
game.close()
