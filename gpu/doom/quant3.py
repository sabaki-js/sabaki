import onnx
from onnx import external_data_helper
from onnxruntime.quantization import quantize_dynamic, QuantType

for cfg in ["invoice_processing", "security_incidents", "agent_trace_observability"]:
    src = f"/tmp/sabaki/minilaya-onnx/{cfg}.onnx"
    m = onnx.load(src)
    del m.graph.value_info[:]
    external_data_helper.convert_model_to_external_data(
        m, all_tensors_to_one_file=True, location=f"{cfg}_novi.onnx.data")
    onnx.save_model(m, f"/tmp/sabaki/minilaya-onnx/{cfg}_novi.onnx")
    quantize_dynamic(f"/tmp/sabaki/minilaya-onnx/{cfg}_novi.onnx",
                     f"/tmp/sabaki/minilaya-onnx/{cfg}_int8.onnx",
                     weight_type=QuantType.QInt8, use_external_data_format=True,
                     extra_options={"UseShapeInference": False})
    print(cfg, "quantified", flush=True)
