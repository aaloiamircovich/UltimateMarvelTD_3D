"""Preparar la guardia de Reed sobre el esqueleto de Meshy, en Blender."""
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector
import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art/models/mister-fantastic-v1"
RAW = ROOT / "artifacts/3d/mister-fantastic-rig-v1/model.glb"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(RAW))
rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
body = next(obj for obj in rig.children_recursive if obj.type == "MESH" and obj.find_armature() == rig)
rig.animation_data_clear()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()

def point_at(name, child, direction):
    """Rota en el espacio del esqueleto, conservando la torsión del hueso."""
    pb = rig.pose.bones[name]
    endpoint = rig.pose.bones[child].head if child else pb.tail
    initial = (endpoint - pb.head).normalized()
    target = (rig.matrix_world.to_3x3().inverted() @ Vector(direction)).normalized()
    rotation = initial.rotation_difference(target)
    original = pb.matrix.copy()
    posed = rotation.to_matrix().to_4x4() @ original
    posed.translation = original.translation
    pb.matrix = posed
    bpy.context.view_layer.update()

for side, sign in [("Right",-1), ("Left",1)]:
    high = side == "Right"
    point_at(side+"Arm", side+"ForeArm", (sign*.09,-.48,-.87))
    point_at(side+"ForeArm", side+"Hand", (-sign*.91,-(.18 if high else .36),.44 if high else .20))
    point_at(side+"Hand", None, (-sign*.94,.20,.26 if high else .08))
    for part in ("Arm","ForeArm","Hand"):
        rig.pose.bones[side+part].keyframe_insert(data_path="rotation_quaternion",frame=1)

# Ciclo cerrado. Pecho y cuello se mueven apenas, sin simular una descarga.
for frame, amount in [(1,0),(49,1),(97,0)]:
    for name, axis, angle in [("Spine",(1,0,0),.014),("Head",(0,0,1),.030)]:
        pb=rig.pose.bones[name]
        local = (rig.matrix_world @ pb.bone.matrix_local).to_quaternion().inverted() @ Vector(axis)
        pb.rotation_quaternion = Quaternion(local, amount*angle)
        pb.keyframe_insert(data_path="rotation_quaternion",frame=frame)
rig.animation_data.action.name="Guardia"
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=97;scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")
for obj in [rig,body]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/"model.glb"), export_format="GLB",
                          use_selection=True, export_yup=True, export_animation_mode="ACTIVE_ACTIONS",
                          export_nla_strips_merged_animation_name="Guardia")
