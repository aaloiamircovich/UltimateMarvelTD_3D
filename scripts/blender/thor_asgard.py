"""Thor: armadura asgardiana, capa plegada, Mjölnir y gesto de descarga."""
from pathlib import Path
import math
import bpy
from mathutils import Vector as V, Quaternion, Matrix

OUT=Path(__file__).resolve().parents[2]/'art/models/thor-v1'
OUT.mkdir(exist_ok=True,parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,rgb,metal=0,rough=.46):
    m=bpy.data.materials.new(name);m.use_nodes=True
    sh=m.node_tree.nodes.get('Principled BSDF')
    sh.inputs['Base Color'].default_value=(*rgb,1);sh.inputs['Metallic'].default_value=metal
    sh.inputs['Roughness'].default_value=rough
    return m
steel=mat('Acero asgardiano',(.23,.28,.30),.75)
bright=mat('Plata bruñida',(.49,.54,.55),.72)
iron=mat('Hierro pavonado',(.048,.062,.078),.68)
leather=mat('Cuero negro',(.026,.020,.026))
red=mat('Carmesí',(.33,.007,.014))
skin=mat('Piel',(.66,.36,.20))
hair=mat('Oro viejo',(.33,.17,.043))
gold=mat('Mechas doradas',(.56,.31,.09))
beard=mat('Barba',(.18,.085,.031))
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
    for z,w in [(1.48,.063),(1.27,.048),(1.07,.043)]:
        x=s*(.168 if z>1.4 else .134)
        ball('Disco de armadura',(x,-.115,z),(w,.031,w),iron)
        ball('Broche de plata',(x,-.134,z+.002),(w*.86,.023,w*.86),bright)
    for z,w in [(1.43,.18),(1.33,.17),(1.18,.15),(1.035,.143)]:
        pts=[(s*.013,-.167,z-.075),(s*w*.55,-.165,z-.013),(s*w,-.134,z+.045),(s*(w+.019),-.127,z+.011),(s*w*.55,-.174,z-.053),(s*.03,-.170,z-.122)]
        shape('Placa en V',pts,[(0,1,4,5),(1,2,3,4)],steel,'Chest')
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
for s in (-1,1):
    for i in range(5):
        a=i*.52; x=s*(.062+.04*math.sin(a));y=-.052+.034*i
        path=[(s*.035,y*.42,1.887),(s*.10,y,1.851),(x+s*.028,y+.002,1.74),
              (x+s*.014,y+.022,1.64),(x+s*.041,y+.015,1.555-i*.005),(x+s*.047,y+.041,1.514)]
        stroke('Mechón',path,.024 if i<4 else .032,hair,'Head')
        stroke('Reflejo',[(x,y-.019,z) for x,y,z in path[:-1]],.006,gold,'Head',5)
for i in range(6):
    path=[(-.030+i*.014,-.052,1.882-i*.001),(-.049+i*.013,-.085,1.870),
          (-.084+i*.009,-.095,1.839-i*.001),(-.102+i*.005,-.075,1.805-i*.005)]
    stroke('Raya lateral',path,.013,hair,'Head',6)
    stroke('Brillo del flequillo',[(x,y-.010,z+.003) for x,y,z in path],.003,gold,'Head',4)
# Martillo de mano izquierda. El pivote de descarga coincide con la cabeza.
x=.371;y=-.103
joint='LeftForeArm'
weapon_start=len(parts)
stroke('Mango',[(x,y,.884),(x,y,1.235)],.022,leather,joint,10)
for i in range(8):
    z=.89+i*.043
    stroke('Espiral',[(x+.022*math.cos(t*math.pi/4),y+.022*math.sin(t*math.pi/4),z+t*.003) for t in range(9)],.0036,bright,joint,4)
center=(x,y,1.281)
box('Uru',center,(.267,.129,.144),blue,joint,.022)
for s in (-1,1):box('Testa',(x+s*.127,y,1.281),(.031,.129,.146),steel,joint,.013)
for off in [-.064,0,.064]:
    stroke('Grabado rúnico',[(x+off-.012,y-.065,1.25),(x+off+.006,y-.066,1.28),(x+off-.009,y-.066,1.28),(x+off+.012,y-.066,1.314)],.0028,rune,joint,5)
stroke('Correa',[(x,y,.888),(x+.022,y,.828),(x+.014,y,.785),(x-.014,y,.788),(x-.020,y,.835),(x,y,.888)],.005,leather,joint)
pivot=V((x,y,.996))
rotation=Matrix.Translation(pivot) @ Matrix.Rotation(.40,4,'Y') @ Matrix.Translation(-pivot)
for o in parts[weapon_start:]:
    bpy.context.view_layer.update()
    o.data.transform(o.matrix_world.inverted() @ rotation @ o.matrix_world)
bones['Mjolnir']=(rotation @ V(center), rotation @ V((x,y,1.326)),joint)
armature=bpy.data.armatures.new('Asgard');rig=bpy.data.objects.new('Thor',armature)
bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in bones.items():
    eb=armature.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
body=bpy.context.object;body.name='Armadura y Mjölnir'
lod=body.modifiers.new('Densidad de combate','DECIMATE')
lod.ratio=min(1,4900/sum(len(f.vertices)-2 for f in body.data.polygons))
bpy.ops.object.modifier_apply(modifier=lod.name)
mod=body.modifiers.new('Rig','ARMATURE');mod.object=rig;body.parent=rig
for frame,strength in [(1,.0),(3,.8),(5,1),(9,.72),(16,0)]:
    for joint,axis,angle in [('LeftArm',(1,0,0),-.86),('LeftForeArm',(1,0,0),-.42),('Chest',(0,0,1),-.15)]:
        pb=rig.pose.bones[joint]
        pb.rotation_quaternion=Quaternion(pb.bone.matrix_local.to_quaternion().inverted()@V(axis),angle*strength)
        pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
rig.animation_data.action.name='Descarga'
bpy.context.scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',export_yup=True)
