"""Human Torch: traje azul y blanco y lanzamiento de fuego; autoría en Blender."""
from pathlib import Path
import math
import bpy
from mathutils import Vector as V, Quaternion, Matrix

OUT=Path(__file__).resolve().parents[2]/'art/models/human-torch-v1'
OUT.mkdir(exist_ok=True,parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,rgb,metal=0,rough=.46):
    m=bpy.data.materials.new(name);m.use_nodes=True
    sh=m.node_tree.nodes.get('Principled BSDF')
    sh.inputs['Base Color'].default_value=(*rgb,1);sh.inputs['Metallic'].default_value=metal
    sh.inputs['Roughness'].default_value=rough
    return m
blue=mat('Azul Fantásticos',(.012,.095,.23),.12)
navy=mat('Costuras azul noche',(.008,.035,.065))
white=mat('Paneles marfil',(.81,.85,.85),.12)
skin=mat('Piel',(.72,.42,.25))
hair=mat('Rubio dorado',(.66,.38,.075))
gold=mat('Reflejos rubios',(.92,.66,.22))
eye=mat('Ojos',(.016,.055,.08))
lips=mat('Labios',(.35,.12,.085))
parts=[]
def bind(o,n,m,j):
    o.name=n;o.data.materials.append(m)
    g=o.vertex_groups.new(name=j);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    parts.append(o);return o
def ball(n,pos,scale,m,j='Chest',tilt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=pos);o=bpy.context.object
    o.scale=scale;o.rotation_euler.y=tilt
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    for f in o.data.polygons:f.use_smooth=True
    return bind(o,n,m,j)
def shape(n,points,faces,m,j,smooth=False):
    mesh=bpy.data.meshes.new(n);mesh.from_pydata(points,[],faces);mesh.update()
    o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o)
    for f in mesh.polygons:f.use_smooth=smooth
    return bind(o,n,m,j)
def loft(n,rows,m,j='Chest',k=18):
    vs=[];fs=[]
    for i,(x,y,z,rx,ry) in enumerate(rows):
        for h in range(k):
            t=h*math.tau/k
            vs.append((x+rx*math.sin(t),y-ry*math.cos(t),z))
            if i:fs.append(((i-1)*k+h,(i-1)*k+(h+1)%k,i*k+(h+1)%k,i*k+h))
    fs.extend([tuple(reversed(range(k))),tuple(range(len(vs)-k,len(vs)))])
    return shape(n,vs,fs,m,j,True)
def stroke(n,points,r,m,j='Chest',k=6):
    points=list(map(V,points));vs=[];fs=[]
    for i,p in enumerate(points):
        axis=(points[min(len(points)-1,i+1)]-points[max(0,i-1)]).normalized()
        u=axis.cross(V((0,1,0)))
        if u.length<.05:u=axis.cross(V((1,0,0)))
        u.normalize();v=axis.cross(u)
        for h in range(k):
            a=math.tau*h/k;vs.append(p+r*(math.cos(a)*u+math.sin(a)*v))
            if i:fs.append(((i-1)*k+h,(i-1)*k+(h+1)%k,i*k+(h+1)%k,i*k+h))
    return shape(n,vs,fs,m,j,True)
def box(n,pos,size,m,j,bevel):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('Chaflán','BEVEL');mod.width=bevel;mod.segments=1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return bind(o,n,m,j)

bones={'Root':((0,0,0),(0,0,.3),None),'Chest':((0,0,.91),(0,0,1.57),'Root'),
       'Head':((0,0,1.59),(0,0,1.90),'Chest')}
loft('Traje entallado',[(0,0,z,x,y) for z,x,y in [
 (.84,.16,.115),(.95,.17,.12),(1.04,.15,.11),(1.16,.16,.115),(1.30,.205,.14),
 (1.43,.235,.15),(1.50,.205,.125),(1.55,.085,.073)]],blue)
loft('Canesú blanco',[(0,0,1.455,.224,.150),(0,0,1.50,.21,.131),(0,0,1.55,.085,.078)],white)
loft('Cuello alto',[(0,0,1.53,.085,.08),(0,0,1.595,.075,.073)],white)
loft('Cinturón',[(0,0,.965,.171,.124),(0,0,1.005,.163,.121)],white)
box('Hebilla',(0,-.129,.985),(.066,.019,.050),navy,'Chest',.006)
box('Centro hebilla',(0,-.141,.985),(.045,.008,.032),white,'Chest',.004)
for side,sign in [('Right',-1),('Left',1)]:
    x=sign*.11
    loft('Pantalón',[(sign*(.14 if z<.65 else .11),0,z,rx,ry) for z,rx,ry in
        [(.40,.061,.068),(.51,.065,.07),(.63,.076,.087),(.78,.092,.10),(.94,.094,.10)]],blue,'Root')
    foot=side+'Foot'
    bones[foot]=((sign*.14,0,.13),(sign*.14,-.13,.06),'Root')
    loft('Bota blanca',[(sign*.14,y,z,rx,ry) for y,z,rx,ry in
        [(-.045,.015,.062,.119),(-.045,.06,.068,.124),(-.015,.12,.059,.09),(0,.19,.048,.059),
         (0,.32,.061,.068),(0,.44,.064,.072)]],white,foot)
    loft('Borde de bota',[(sign*.14,0,.426,.066,.074),(sign*.14,0,.448,.066,.074)],navy,foot)
    stroke('Costura lateral',[(sign*.205,.005,.89),(sign*.214,.004,.76),(sign*.204,.004,.60),(sign*.201,.005,.46)],.004,navy,'Root',4)
    arm=side+'Arm';fore=side+'ForeArm';hand=side+'Hand'
    bones[arm]=((sign*.217,0,1.465),(sign*.29,-.01,1.22),'Chest')
    bones[fore]=((sign*.29,-.01,1.22),(sign*.34,-.07,1.015),arm)
    bones[hand]=((sign*.34,-.07,1.015),(sign*.35,-.08,.93),fore)
    ball('Hombro blanco',(sign*.228,0,1.456),(.088,.103,.079),white,arm)
    ball('Manga azul',(sign*.259,-.005,1.35),(.074,.081,.145),blue,arm,-sign*.24)
    stroke('Vivo blanco de manga',[(sign*.281,-.059,1.43),(sign*.310,-.050,1.30),(sign*.322,-.039,1.24)],.013,white,arm)
    loft('Antebrazo',[(sign*x,y,z,rx,ry) for x,y,z,rx,ry in
        [(.342,-.07,1.01,.042,.044),(.326,-.055,1.09,.055,.057),(.30,-.017,1.20,.057,.06),(.29,-.01,1.24,.052,.056)]],blue,fore)
    loft('Puño blanco',[(sign*.342,-.071,1.012,.046,.049),(sign*.33,-.058,1.07,.051,.053)],white,fore)
    ball('Palma',(sign*.35,-.08,.978),(.046,.028,.054),skin,hand)
    for i in range(4):
        x=sign*(.319+i*.019)
        stroke('Dedo',[(x,-.08,.959),(x,-.089,.925),(x,-.102,.916)],.009,skin,hand)
    stroke('Pulgar',[(sign*.316,-.082,.994),(sign*.297,-.105,.965),(sign*.304,-.111,.952)],.013,skin,hand)
# Medallón y número geométricos: legibles desde la cámara de combate.
ball('Emblema blanco',(.10,-.143,1.38),(.055,.012,.055),white)
bpy.ops.object.text_add(location=(.10,-.160,1.38),rotation=(math.pi/2,0,0))
o=bpy.context.object;o.data.body='4';o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=.092;o.data.extrude=.001
bpy.ops.object.convert(target='MESH');bind(bpy.context.object,'Cuatro',blue,'Chest')
# Cabeza sin máscara y cabello corto elevado.
ball('Cuello',(0,0,1.60),(.068,.068,.075),skin,'Head')
loft('Rostro',[(0,y,z,x,d) for z,y,x,d in [(1.615,-.035,.045,.049),(1.64,-.027,.072,.067),
 (1.69,-.014,.096,.086),(1.75,-.006,.102,.096),(1.81,.002,.094,.088),(1.85,.004,.065,.065)]],skin,'Head',22)
for sign in (-1,1):
    ball('Oreja',(sign*.098,.0,1.724),(.018,.018,.032),skin,'Head')
    ball('Ojo',(sign*.041,-.097,1.75),(.021,.009,.010),white,'Head')
    ball('Iris',(sign*.041,-.105,1.75),(.008,.004,.008),eye,'Head')
    stroke('Ceja',[(sign*.019,-.099,1.766),(sign*.049,-.098,1.773),(sign*.073,-.085,1.768)],.005,hair,'Head')
ball('Nariz',(0,-.103,1.723),(.018,.024,.026),skin,'Head')
stroke('Boca',[(-.031,-.093,1.678),(0,-.103,1.675),(.031,-.093,1.678)],.0035,lips,'Head')
ball('Cabello',(0,.01,1.819),(.104,.095,.065),hair,'Head')
for i in range(9):
    x=(i-4)*.021
    rise=.018*math.sin(i*1.3)
    path=[(x,-.077,1.818),(x+.012,-.060,1.86+rise),(x+.025,-.005,1.885+rise),(x+.016,.041,1.85)]
    stroke('Mechón elevado',path,.017,hair,'Head',6)
    stroke('Reflejo',[(x,y-.006,z+.008) for x,y,z in path],.004,gold,'Head',4)
armature=bpy.data.armatures.new('Fantastico');rig=bpy.data.objects.new('HumanTorch',armature)
bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in bones.items():
    eb=armature.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
body=bpy.context.object;body.name='Traje y rostro de Johnny'
lod=body.modifiers.new('Densidad de combate','DECIMATE')
lod.ratio=min(1,4900/sum(len(f.vertices)-2 for f in body.data.polygons))
bpy.ops.object.modifier_apply(modifier=lod.name)
mod=body.modifiers.new('Rig','ARMATURE');mod.object=rig;body.parent=rig
for frame,strength in [(1,1),(5,1),(16,0),(25,0)]:
    for joint,axis,angle in [('RightArm',(1,0,0),-1.35),('RightForeArm',(1,0,0),-.20),('Chest',(0,0,1),-.08)]:
        pb=rig.pose.bones[joint]
        pb.rotation_quaternion=Quaternion(pb.bone.matrix_local.to_quaternion().inverted()@V(axis),angle*strength)
        pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
rig.animation_data.action.name='Lanzamiento'
bpy.context.scene.frame_set(25)
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',export_yup=True)
