"""Equipa los blásters sobre el rig de Meshy y reúne los clips en un GLB."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'artifacts/3d/star-lord-rig-v1'
OUT = ROOT / 'art/models/star-lord-v1'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(RAW / 'model.glb'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = next(o for o in rig.children_recursive if o.type == 'MESH' and o.find_armature() == rig)
rig.animation_data_clear()
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
rig.data.pose_position = 'REST'

def material(name, color, metal):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = .32
    return m

alloy = material('Aleación clara', (.48,.53,.62), .72)
graphite = material('Grafito', (.034,.042,.055), .55)
plasma = material('Plasma violeta', (.72,.038,.55), .24)
weapons = []
for side, name in [(1,'LeftHand'),(-1,'RightHand')]:
    bone = rig.data.bones[name]
    wrist = rig.matrix_world @ bone.head_local
    axis = (rig.matrix_world @ bone.tail_local - wrist).normalized()
    grip = wrist + axis * .075
    pieces = []
    def block(label, offset, size, mat, bevel=.004, angle=0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=grip+Vector(offset))
        o=bpy.context.object
        o.name=label
        o.dimensions=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        o.rotation_euler.x=angle
        o.data.materials.append(mat)
        m=o.modifiers.new('Bordes','BEVEL');m.width=bevel;m.segments=1
        bpy.ops.object.modifier_apply(modifier=m.name)
        pieces.append(o)
    block('Empuñadura',(0,0,0),(.036,.046,.105),graphite,angle=-.18)
    block('Cuerpo',(0,-.077,.050),(.065,.245,.066),graphite,.010)
    for s in [-1,1]:
        block('Placa lateral',(s*.029,-.093,.061),(.017,.22,.049),alloy,.007)
        block('Canal',(s*.039,-.10,.063),(.005,.085,.011),plasma,.002)
    block('Cañón superior',(0,-.132,.085),(.045,.143,.026),alloy)
    block('Boca',(0,-.207,.06),(.057,.021,.052),graphite)
    block('Emisor',(0,-.219,.06),(.026,.005,.022),plasma)
    bpy.ops.object.select_all(action='DESELECT')
    for o in pieces:o.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    bpy.ops.object.join()
    weapon=bpy.context.object
    weapon.name='Blaster_'+name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    g=weapon.vertex_groups.new(name=name)
    g.add(list(range(len(weapon.data.vertices))),1,'REPLACE')
    mod=weapon.modifiers.new('Seguir mano','ARMATURE');mod.object=rig
    world=weapon.matrix_world.copy()
    weapon.parent=rig;weapon.matrix_world=world
    weapons.append(weapon)

rig.data.pose_position='POSE'
animation=rig.animation_data_create()
for filename, label in [('walk','Caminar'),('run','Correr')]:
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(RAW / (filename+'.glb')))
    imported=set(bpy.data.objects)-before
    other=next(o for o in imported if o.type=='ARMATURE')
    action=other.animation_data.action
    slot=other.animation_data.action_slot
    action.name=label
    track=animation.nla_tracks.new();track.name=label
    strip=track.strips.new(label,1,action)
    if slot: strip.action_slot=slot
    track.mute=True
    for o in imported:bpy.data.objects.remove(o,do_unlink=True)

bpy.ops.object.select_all(action='DESELECT')
for o in [rig,body,*weapons]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'), export_format='GLB',
    use_selection=True, export_animation_mode='NLA_TRACKS', export_yup=True)
