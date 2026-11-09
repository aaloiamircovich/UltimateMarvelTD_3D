"""Preparar la disparo de Hawkeye sobre el esqueleto de Meshy, en Blender."""
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector
import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art/models/hawkeye-v1"
RAW = ROOT / "artifacts/3d/hawkeye-rig-v2/model.glb"
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

# El arco se coloca en la derecha, siguiendo la referencia anterior.
for frame, aim in [(1,1),(5,.85),(14,0),(25,0)]:
    for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    point_at("RightArm","RightForeArm",(-.18,-(.1+.9*aim),-.94*(1-aim)))
    point_at("RightForeArm","RightHand",(-.08,-(.3+.7*aim),-.87*(1-aim)))
    point_at("RightHand",None,(0,-1,0))
    point_at("LeftArm","LeftForeArm",(.7,-.12,-.6*(1-aim)))
    point_at("LeftForeArm","LeftHand",(-.55,-.40,.65*aim-.5*(1-aim)))
    for side in ("Right","Left"):
        for part in ("Arm","ForeArm","Hand"):
            rig.pose.bones[side+part].keyframe_insert(data_path="rotation_quaternion",frame=frame)
rig.animation_data.action.name="Disparo"
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=25;scene.frame_set(25)
# Arco recurvo, independiente de la malla y unido al hueso de la mano.
scene.frame_set(1);bpy.context.view_layer.update()
hand=rig.pose.bones['RightHand']
grip=rig.matrix_world @ hand.head
bowmat=bpy.data.materials.new('Arco grafito');bowmat.use_nodes=True
sh=bowmat.node_tree.nodes.get('Principled BSDF');sh.inputs['Base Color'].default_value=(.022,.025,.032,1);sh.inputs['Metallic'].default_value=.45;sh.inputs['Roughness'].default_value=.42
stringmat=bpy.data.materials.new('Cuerda');stringmat.diffuse_color=(.48,.48,.44,1)
weapons=[]
def tube(name, points, radius, material):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=1
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,offset in zip(spline.points,points):p.co=(*(grip+Vector(offset)),1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH');obj=bpy.context.object
    # Pasar de la pose de disparo a bind pose antes de aplicar el modificador.
    # Evita el desfase de escala de objetos parentados al hueso de Meshy.
    bind=rig.matrix_world @ rig.data.bones['RightHand'].matrix_local @ hand.matrix.inverted() @ rig.matrix_world.inverted()
    obj.data.transform(bind @ obj.matrix_world)
    obj.matrix_world=Matrix.Identity(4)
    group=obj.vertex_groups.new(name='RightHand');group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Rig arco','ARMATURE');mod.object=rig
    obj.parent=rig;obj.matrix_world=Matrix.Identity(4)
    weapons.append(obj);obj.select_set(False)
points=[(0,.12,-.55),(0,.09,-.48),(0,-.035,-.34),(0,-.065,-.21),(0,-.025,-.10),(0,0,0),(0,-.025,.10),(0,-.065,.21),(0,-.035,.34),(0,.09,.48),(0,.12,.55)]
bpy.ops.object.select_all(action='DESELECT')
tube('Arco recurvo',points,.012,bowmat)
tube('Empuñadura',[(0,0,-.065),(0,0,.065)],.020,bowmat)
tube('Cuerda',[(0,.12,-.55),(0,.12,0),(0,.12,.55)],.002,stringmat)
scene.frame_set(25)
bpy.ops.object.select_all(action="DESELECT")
for obj in [rig,body,*weapons]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/"model.glb"), export_format="GLB",
                          use_selection=True, export_yup=True, export_animation_mode="ACTIVE_ACTIONS",
                          export_nla_strips_merged_animation_name="Disparo")
