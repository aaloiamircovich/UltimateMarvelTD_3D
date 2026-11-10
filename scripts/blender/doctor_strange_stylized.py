"""Thor: armadura asgardiana, capa plegada, Mjölnir y gesto de descarga."""
from pathlib import Path
import math
import bpy
from mathutils import Vector as V, Quaternion, Matrix

OUT=Path(__file__).resolve().parents[2]/'art/models/doctor-strange-stylized-v1'
OUT.mkdir(exist_ok=True,parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,rgb,metal=0,rough=.46):
    m=bpy.data.materials.new(name);m.use_nodes=True
    sh=m.node_tree.nodes.get('Principled BSDF')
    sh.inputs['Base Color'].default_value=(*rgb,1);sh.inputs['Metallic'].default_value=metal
    sh.inputs['Roughness'].default_value=rough
    return m
steel=mat('Acero asgardiano',(.035,.09,.18),0)
bright=mat('Plata bruñida',(.32,.25,.12),.35)
iron=mat('Hierro pavonado',(.015,.035,.09),0)
leather=mat('Cuero negro',(.026,.020,.026))
red=mat('Carmesí',(.33,.007,.014))
skin=mat('Piel',(.66,.36,.20))
hair=mat('Oro viejo',(.022,.016,.014))
gold=mat('Mechas doradas',(.22,.23,.24))
beard=mat('Barba',(.035,.020,.015))
white=mat('Marfil',(.80,.79,.73))
blue=mat('Uru azul',(.04,.38,.61),.65)
rune=mat('Runa de tormenta',(.26,.84,1),.27)
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
bones={'Root':((0,0,0),(0,0,.3),None),'Chest':((0,0,.90),(0,0,1.64),'Root'),
       'Head':((0,0,1.60),(0,0,1.90),'Chest')}
loft('Coraza',[(0,0,z,x,y) for z,x,y in [
 (.83,.16,.12),(.96,.192,.131),(1.08,.166,.121),(1.20,.185,.13),(1.34,.229,.15),
 (1.44,.25,.158),(1.51,.22,.13),(1.56,.094,.085)]],iron)
loft('Gorjal',[(0,0,1.48,.157,.128),(0,0,1.54,.106,.094),(0,0,1.59,.085,.081)],steel)
for s in (-1,1):
    x=s*.112
    loft('Muslera',[(s*(.14 if z<.65 else .112),0,z,rx,ry) for z,rx,ry in
         [(.46,.068,.078),(.54,.081,.084),(.66,.082,.093),(.84,.104,.11),(.96,.085,.091)]],leather,'Root')
    loft('Greba',[(s*.15,y,z,rx,ry) for y,z,rx,ry in
         [(-.055,.014,.069,.130),(-.055,.054,.073,.134),(-.023,.107,.065,.10),(0,.159,.05,.061),
          (.008,.305,.073,.084),(0,.432,.071,.072),(-.013,.49,.069,.073)]],iron,'Root')
    pts=[(s*.15,-.095,.50),(s*.15-.066,-.055,.441),(s*.15-.025,-.065,.196),(s*.15,-.085,.126),(s*.15+.062,-.062,.432)]
    shape('Escudo de la greba',pts,[(0,1,2,3),(0,3,4)],steel,'Root')
    # Placas de faldón entre el cinturón y los muslos.
    pts=[(s*.008,-.14,1.007),(s*.181,-.095,1.025),(s*.217,-.072,.78),(s*.11,-.139,.707),(s*.027,-.147,.836)]
    shape('Faldón',pts,[(0,1,2,3,4)],iron,'Root')
    stroke('Vivo del faldón',pts[1:4],.007,steel,'Root')
    side='Left' if s>0 else 'Right';arm=side+'Arm';fore=side+'ForeArm'
    bones[arm]=((s*.218,0,1.47),(s*.300,0,1.22),'Chest')
    bones[fore]=((s*.300,0,1.22),(s*.364,-.088,1.033),arm)
    ball('Cota de malla',(s*.252,0,1.364),(.091,.104,.168),steel,arm,-s*.28)
    ball('Hombrera',(s*.223,.004,1.478),(.106,.116,.085),iron,arm)
    for h in range(4):
        xx=s*(.24+.012*h);z=1.436-.040*h
        stroke('Escama',[(xx-.059,-.060,z),(xx,-.098,z-.025),(xx+.059,-.065,z)],.006,bright,arm,4)
    loft('Brazal',[(s*x,y,z,rx,ry) for x,y,z,rx,ry in
         [(.366,-.088,1.04,.045,.049),(.349,-.078,1.097,.056,.063),(.321,-.03,1.20,.067,.070),(.302,0,1.247,.059,.063)]],steel,fore)
    ball('Mano',(s*.371,-.10,.996),(.055,.053,.069),skin,fore)
    for i in range(4):ball('Nudillo',(s*(.341+i*.018),-.138,1.003),(.013,.015,.023),skin,fore)
# Capa ondulada, la parte superior descansa entre los broches y el trapecio.
vs=[];fs=[]
for i in range(8):
    t=i/7
    for k in range(23):
        u=(k-11)/11
        vs.append((u*(.245+.16*t)-.076*t*t,.064+.145*t+.085*(1-u*u)+(.017+.022*t)*math.cos(u*5*math.pi),
                   1.508-1.22*t+.035*(1-u*u)+t*.024*math.sin(u*4*math.pi)))
        if i and k:fs.append((i*23+k-24,i*23+k-1,i*23+k,i*23+k-23))
shape('Capa escarlata',vs,fs,red,'Chest',True)
for s in (-1,1):ball('Capa sobre hombro',(s*.199,.015,1.515),(.098,.133,.044),red)
ball('Cuello',(0,0,1.57),(.080,.077,.103),skin,'Head')
loft('Rostro',[(0,y,z,x,d) for z,y,x,d in [(1.583,-.04,.047,.059),(1.61,-.031,.078,.079),(1.657,-.019,.101,.092),
 (1.725,-.008,.113,.103),(1.787,0,.109,.099),(1.84,.006,.090,.085),(1.865,.008,.054,.05)]],skin,'Head',22)
for s in (-1,1):
    ball('Ojo',(s*.044,-.105,1.734),(.022,.010,.009),white,'Head')
    ball('Iris',(s*.044,-.114,1.734),(.008,.004,.008),iron,'Head')
    stroke('Ceja',[(s*.018,-.106,1.748),(s*.052,-.106,1.756),(s*.077,-.092,1.752)],.006,beard,'Head')
ball('Nariz',(0,-.109,1.708),(.022,.027,.034),skin,'Head')
loft('Barba',[(0,y,z,x,d) for z,y,x,d in [(1.572,-.059,.032,.031),(1.601,-.052,.071,.061),
 (1.633,-.033,.093,.084),(1.662,-.021,.10,.092)]],beard,'Head')
stroke('Bigote',[(-.050,-.099,1.665),(-.022,-.119,1.675),(0,-.118,1.671),(.022,-.119,1.675),(.050,-.099,1.665)],.008,beard,'Head')
ball('Cabello',(0,.008,1.821),(.119,.107,.083),hair,'Head')
for i in range(6):
    path=[(-.030+i*.014,-.052,1.882-i*.001),(-.049+i*.013,-.085,1.870),
          (-.084+i*.009,-.095,1.839-i*.001),(-.102+i*.005,-.075,1.805-i*.005)]
    stroke('Raya lateral',path,.013,hair,'Head',6)
    stroke('Brillo del flequillo',[(x,y-.010,z+.003) for x,y,z in path],.003,gold,'Head',4)

# Túnica con faldones y cinturón ancho.
loft('Túnica azul',[(0,0,.59,.225,.135),(0,0,.85,.205,.14),(0,0,1.03,.18,.135)],iron,'Root')
loft('Cinturón',[(0,0,1.015,.188,.145),(0,0,1.09,.18,.14)],leather)
for z in (1.03,1.06,1.085):
    stroke('Correa cruzada',[(-.17,-.10,z), (0,-.151,z-.02),(.17,-.10,z+.01)],.009,bright)
amulet=mat('Oro del amuleto',(.72,.45,.08),.65)
stroke('Cordón',[(-.07,-.09,1.56),(-.06,-.17,1.40),(0,-.18,1.31),(.06,-.17,1.40),(.07,-.09,1.56)],.005,amulet)
ball('Ojo de Agamotto',(0,-.181,1.31),(.052,.016,.052),amulet)
ball('Gema',(0,-.198,1.31),(.018,.005,.023),rune)
for side in (-1,1):
    shape('Cuello alto',[(side*.07,.04,1.53),(side*.16,.04,1.74),(side*.21,.08,1.69),(side*.22,.11,1.51)],[(0,1,2,3)],red,'Chest')
armature=bpy.data.armatures.new('Hechicero');rig=bpy.data.objects.new('Doctor Strange',armature)
bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in bones.items():
    eb=armature.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
body=bpy.context.object;body.name='Túnica y capa'
lod=body.modifiers.new('Densidad de combate','DECIMATE')
lod.ratio=min(1,4900/sum(len(f.vertices)-2 for f in body.data.polygons))
bpy.ops.object.modifier_apply(modifier=lod.name)
mod=body.modifiers.new('Rig','ARMATURE');mod.object=rig;body.parent=rig
for frame,strength in [(1,.0),(3,.8),(5,1),(9,.72),(16,0)]:
    for joint,axis,angle in [('LeftArm',(1,0,0),-.86),('LeftForeArm',(1,0,0),-.42),('Chest',(0,0,1),-.15)]:
        pb=rig.pose.bones[joint]
        pb.rotation_quaternion=Quaternion(pb.bone.matrix_local.to_quaternion().inverted()@V(axis),angle*strength)
        pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
rig.animation_data.action.name='Conjuro'
bpy.context.scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',export_yup=True)
