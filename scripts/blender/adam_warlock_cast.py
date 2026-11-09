"""Preparar la canalización de Adam sobre el esqueleto de Meshy, en Blender."""
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector
import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art/models/adam-warlock-v1"
RAW = ROOT / "artifacts/3d/adam-warlock-rig-v1/model.glb"
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

# La mano izquierda canaliza energía; la derecha conserva el bastón.
# Clip visual: no programa daño ni altera las reglas del capullo.
for frame, power in [(1,1),(5,1),(16,0),(25,0)]:
    for pb in rig.pose.bones:
        pb.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    for side, sign in [("Right",-1),("Left",1)]:
        if side=="Right": continue
        point_at(side+"Arm",side+"ForeArm",(sign*.20,-(.16+.80*power),-.90*(1-power)))
        point_at(side+"ForeArm",side+"Hand",(sign*.12,-(.32+.68*power),-.80*(1-power)))
        point_at(side+"Hand",None,(sign*.10,-(.45+.55*power),-.65*(1-power)))
        for part in ("Arm","ForeArm","Hand"):
            rig.pose.bones[side+part].keyframe_insert(data_path="rotation_quaternion",frame=frame)
rig.animation_data.action.name="Canalizacion"
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=25;scene.frame_set(25)
bpy.ops.object.select_all(action="DESELECT")
for obj in [rig,body]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/"model.glb"), export_format="GLB",
                          use_selection=True, export_yup=True, export_animation_mode="ACTIVE_ACTIONS",
                          export_nla_strips_merged_animation_name="Canalizacion")
