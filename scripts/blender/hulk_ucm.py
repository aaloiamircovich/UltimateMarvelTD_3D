"""Hulk cinematográfico estilizado: escultura por volúmenes, rig y golpe."""
from pathlib import Path
import math
import random
import bpy
from mathutils import Vector, Quaternion

out = Path(__file__).resolve().parents[2] / 'art/models/hulk-v1'
out.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = random.Random(24)
def material(name, color):
    m=bpy.data.materials.new(name);m.use_nodes=True
    sh=m.node_tree.nodes.get('Principled BSDF')
    sh.inputs['Base Color'].default_value=(*color,1)
    sh.inputs['Roughness'].default_value=.66
    return m
skin=material('Oliva gamma',(.075,.129,.030))
shorts=material('Pantalón grafito',(.041,.034,.052))
seam=material('Panel granate',(.092,.039,.047))
hair=material('Cabello oscuro',(.010,.013,.007))
eyes=material('Marfil',(.68,.67,.44))
iris=material('Iris verde',(.035,.078,.021))
crease=material('Sombra de boca',(.040,.031,.020))
collection=[]
def volume(label,pos,size,mat,joint,tilt=0,segments=14, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos)
    o=bpy.context.object;o.name=label;o.scale=size;o.rotation_euler.y=tilt
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=True
    group=o.vertex_groups.new(name=joint);group.add(list(range(len(o.data.vertices))),1,'REPLACE')
    collection.append(o)
    return o
def fuse(start,label,mat,joint,vox=.022,ratio=.15):
    parts=collection[start:];bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    obj=parts[0];bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
    obj.name=label;obj.data.remesh_voxel_size=vox;bpy.ops.object.voxel_remesh()
    for kind,attrs in [('SMOOTH',{'factor':.70,'iterations':4}),('DECIMATE',{'ratio':ratio*.50})]:
        mod=obj.modifiers.new(kind,kind)
        for key,val in attrs.items():setattr(mod,key,val)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.clear();obj.data.materials.append(mat)
    for f in obj.data.polygons:f.use_smooth=True
    obj.vertex_groups.clear();g=obj.vertex_groups.new(name=joint)
    g.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    collection[start:]=[obj]
bones={}
def bone(n,a,b,parent=None):bones[n]=(a,b,parent)
bone('Root',(0,0,0),(0,0,.3))
bone('Chest',(0,0,1.20),(0,-.025,2.19),'Root')
bone('Head',(0,-.07,2.11),(0,-.10,2.65),'Chest')
def chest(name,pos,size,tilt=0):volume(name,pos,size,skin,'Chest',tilt)
chest('Costillas',(0,.015,1.83),(.53,.31,.53))
chest('Cintura',(0,0,1.48),(.34,.25,.37))
chest('Cuello',(0,-.06,2.16),(.21,.2,.22))
for s in [-1,1]:
    chest('Pectoral',(s*.238,-.198,1.958),(.30,.17,.18),-s*.10)
    chest('Trapecio',(s*.245,.055,2.166),(.33,.205,.15),s*.38)
    chest('Dorsal',(s*.35,.09,1.84),(.175,.22,.32),s*.31)
    for i in range(3):
        chest('Abdominal',(s*.105,-.211,1.76-i*.124),(.113,.065,.095))
fuse(0,'Torso',skin,'Chest',.021,.12)
start=len(collection)
def face(n,pos,size,tilt=0):volume(n,pos,size,skin,'Head',tilt)
face('Cráneo',(0,-.093,2.398),(.224,.200,.271))
face('Mandíbula',(0,-.158,2.303),(.211,.184,.156))
face('Mentón',(0,-.262,2.247),(.152,.091,.080))
face('Nariz',(0,-.298,2.397),(.063,.092,.092))
for s in [-1,1]:
    face('Pómulo',(s*.130,-.247,2.359),(.082,.056,.061),-s*.2)
    face('Oreja',(s*.217,-.083,2.399),(.045,.04,.079))
    face('Ceño',(s*.096,-.281,2.467),(.108,.057,.039),-s*.25)
fuse(start,'Rostro',skin,'Head',.009,.14)
for s in [-1,1]:
    volume('Ojo',(s*.092,-.298,2.43),(.048,.028,.022),eyes,'Head',-s*.13)
    volume('Pupila',(s*.087,-.324,2.43),(.016,.008,.016),iris,'Head')
volume('Boca',(0,-.323,2.294),(.113,.020,.019),crease,'Head')
volume('Dientes apretados',(0,-.344,2.299),(.087,.008,.008),eyes,'Head')
start=len(collection)
volume('Masa cabello',(0,-.08,2.566),(.231,.199,.150),hair,'Head')
for i in range(40):
    a=rng.uniform(0,2*math.pi);r=rng.random()**.5
    volume('Mechón',(.205*r*math.cos(a),-.08+.17*r*math.sin(a),2.592+.070*(1-r*r)),(.045,.043,.065),hair,'Head',rng.uniform(-.5,.5),9)
fuse(start,'Pelo corto',hair,'Head',.015,.17)
# Mechones con punta, siguiendo la línea de la frente hacia las sienes.
for i in range(17):
    t=(i-8)*.156
    x=.205*math.sin(t); y=-.08-.167*math.cos(t)
    z=2.576+rng.uniform(-.014,.018)
    bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.007,radius2=.045,depth=.103,location=(x,y,z))
    lock=bpy.context.object;lock.name='Flequillo';lock.rotation_euler.y=-.40+.20*math.sin(t)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    lock.data.materials.append(hair)
    g=lock.vertex_groups.new(name='Head');g.add(list(range(len(lock.data.vertices))),1,'REPLACE')
    collection.append(lock)
volume('Cadera',(0,0,1.25),(.36,.26,.31),shorts,'Root')
volume('Pretina',(0,-.003,1.388),(.348,.255,.080),shorts,'Root')
for s,side in [(-1,'Right'),(1,'Left')]:
    arm=side+'Arm';fore=side+'ForeArm'
    bone(arm,(s*.48,0,2.035),(s*.72,-.01,1.689),'Chest')
    bone(fore,(s*.72,-.01,1.689),(s*.82,-.19,1.385),arm)
    start=len(collection)
    def limb(n,pos,size,b,tilt=0):volume(n,(s*pos[0],*pos[1:]),size,skin,b,s*tilt)
    limb('Deltoides',(.49,0,2.025),(.232,.25,.235),arm,-.3)
    limb('Bíceps',(.629,-.071,1.843),(.152,.176,.237),arm,-.46)
    limb('Tríceps',(.627,.057,1.850),(.147,.15,.25),arm,-.47)
    fuse(start,side+' brazo',skin,arm,.017,.12)
    start=len(collection)
    limb('Codo',(.719,-.013,1.687),(.136,.14,.135),fore)
    limb('Antebrazo',(.78,-.10,1.547),(.149,.17,.222),fore,-.24)
    limb('Puño',(.827,-.188,1.354),(.127,.137,.135),fore)
    for k in range(4):
        limb('Nudillo',(.750+k*.049,-.278,1.325+.018*math.sin(k)),(.033,.060,.055),fore)
    limb('Pulgar',(.735,-.262,1.376),(.046,.077,.059),fore)
    fuse(start,side+' puño y antebrazo',skin,fore,.014,.13)
    # El pantalón llega a la rodilla; el dobladillo sigue el volumen del muslo.
    volume('Muslo',(s*.248,0,1.041),(.204,.235,.342),shorts,'Root',-s*.21)
    volume('Dobladillo',(s*.296,-.002,.841),(.174,.198,.098),shorts,'Root',-s*.16)

    start=len(collection)
    limb('Rodilla',(.301,-.012,.771),(.146,.162,.173),'Root')
    limb('Gemelo',(.321,.036,.533),(.153,.168,.262),'Root',-.08)
    limb('Tobillo',(.346,0,.258),(.104,.125,.192),'Root')
    limb('Pie',(.354,-.071,.114),(.146,.224,.115),'Root')
    for k in range(5):
        limb('Dedo del pie',(.272+k*.043,-.226+.012*k,.079),(.041-.003*k,.090-.009*k,.05),'Root')
    fuse(start,side+' pierna',skin,'Root',.015,.12)
# Un solo pantalón continuo, con franjas rasantes al costado.
fabric=[o for o in collection if o.data.materials[0]==shorts]
collection[:]=[o for o in collection if o not in fabric]
start=len(collection);collection.extend(fabric)
fuse(start,'Pantalón',shorts,'Root',.023,.12)
pants=collection[-1];pants.data.materials.append(seam)
for f in pants.data.polygons:
    x,y,z=f.center
    if abs(x)>.32 and abs(y+.03+.18*(z-1))<.033:f.material_index=1
armature=bpy.data.armatures.new('Rig Hulk')
rig=bpy.data.objects.new('Hulk',armature);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in bones.items():
    eb=armature.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for obj in collection:obj.select_set(True)
bpy.context.view_layer.objects.active=collection[0];bpy.ops.object.join()
body=bpy.context.object;body.name='Hulk UCM'
lod=body.modifiers.new('Densidad para combate','DECIMATE')
lod.ratio=min(1,4900/max(1,sum(len(p.vertices)-2 for p in body.data.polygons)))
bpy.ops.object.modifier_apply(modifier=lod.name)
mod=body.modifiers.new('Rig','ARMATURE');mod.object=rig;body.parent=rig
# Golpe corto: extensión del brazo, rotación del tronco y recuperación.
for frame,power in [(1,0),(3,.85),(5,1),(9,.65),(15,0)]:
    for joint,axis,angle in [('RightArm',(1,0,0),-1.14),('RightForeArm',(1,0,0),-.32),('LeftArm',(1,0,0),.22),('Chest',(0,0,1),.22)]:
        pb=rig.pose.bones[joint];local=pb.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
        pb.rotation_quaternion=Quaternion(local,angle*power)
        pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
rig.animation_data.action.name='Golpe'
bpy.context.scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(out/'model.glb'),export_format='GLB',export_yup=True)
