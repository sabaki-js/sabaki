# Rebuild GPU (Kaggle éphémère)
Tout redémarrage = boîte neuve. Procédure (~15 min) :
```bash
pip install -q "opendecider[serve]" datasets scikit-learn
(nohup opendecider serve --model manjunathshiva/opendecider-nano > /tmp/od.log 2>&1 &)
# états (cache/) : les régénérer via datasets-server (voir train.py) ou les rescaper
python3 gpu/collect_gpu.py   # soft labels prof -> teacher/
python3 gpu/train_minilaya.py  # ou train_doom_base.py (STUDENT=...)
python3 gpu/export_minilaya.py # ONNX
```
Poids de référence : repo HF privé `fox3000foxy/sabaki` + release publique
`sabaki-js/sabaki-models` v0.1.0. Rien ne persiste sur la boîte.
