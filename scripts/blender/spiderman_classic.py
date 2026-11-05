"""Spider-Man clásico. Construcción de superficies, trama y rig en metros."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[2] / "art/models/spiderman-v1"
OUT.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
pi=math.pi
V=Vector
def mat(name,rgb,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*rgb,1)
    shader.inputs['Metallic'].default_value=metal
    shader.inputs['Roughness'].default_value=.48
    return m
red=mat("Carmesí",(.55,.015,.025))
blue=mat("Azul medianoche",(.012,.042,.105))
ink=mat("Tinta",(.009,.009,.018))
white=mat("Lentes marfil",(.90,.96,1),.15)

skeleton={}
def bone(name,start,end,parent=None):
    skeleton[name]=(V(start),V(end),parent)
def rigid(name):return {name:1}
def mix(a,b,t):
    t=min(1,max(0,t));return {a:1-t,b:t}
objects=[]
def mesh(name,points,faces,materials,indices,weights):
    d=bpy.data.meshes.new(name);d.from_pydata(points,[],faces);d.update()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
    for m in materials:d.materials.append(m)
    for f,i in zip(d.polygons,indices):f.material_index=i;f.use_smooth=True
    groups={}
    for i,ws in enumerate(weights):
        for n,w in ws.items():
            if w<=0:continue
            if n not in groups:groups[n]=o.vertex_groups.new(name=n)
            groups[n].add([i],w,'REPLACE')
    objects.append(o)
def tube(name,points,rad,material,weights,n=5):
    points=list(map(V,points));v=[];f=[];ws=[]
    if material==ink and rad<.002:
        # The printed web is a surface marking. Two vertices per sample
        # preserve its width at tactical distance without modeling tiny tubes.
        for i,p in enumerate(points):
            axis=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
            cx=0 if p.z>.7 else (.15 if p.x>0 else -.15)
            normal=V((p.x-cx,p.y-(.004 if p.z>1.45 else 0),0)).normalized()
            width=normal.cross(axis).normalized()*rad
            v.extend((p-width,p+width));ws.extend((weights(p),weights(p)))
            if i:f.append((2*i-2,2*i,2*i+1,2*i-1))
        mesh(name,v,f,[material],[0]*len(f),ws)
        return
    for i,p in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        a=tangent.cross(V((0,1,0)))
        if a.length<.05:a=tangent.cross(V((1,0,0)))
        a.normalize();b=tangent.cross(a).normalized()
        for j in range(n):
            t=j*2*pi/n;v.append(p+rad*(a*math.cos(t)+b*math.sin(t)));ws.append(weights(p))
            if i:f.append(((i-1)*n+j,(i-1)*n+(j+1)%n,i*n+(j+1)%n,i*n+j))
    mesh(name,v,f,[material],[0]*len(f),ws)

def loft(name,rows,materials,color,weight,n):
    # Rows run bottom to top: centre X,Y,Z then lateral and depth radii.
    def sample(i,t,gap=0):
        x,y,z,rx,ry=rows[i]
        return V((x+(rx+gap)*math.sin(t),y-(ry+gap)*math.cos(t),z))
    verts=[];faces=[];ids=[];ws=[]
    for i,r in enumerate(rows):
        for j in range(n):
            t=j*2*pi/n;p=sample(i,t);verts.append(p);ws.append(weight(p))
            if i:
                faces.append(((i-1)*n+j,(i-1)*n+(j+1)%n,i*n+(j+1)%n,i*n+j))
                ids.append(color(i,(j+.5)*2*pi/n))
    for idx in (0,len(rows)-1):
        faces.append(tuple(idx*n+j for j in (reversed(range(n)) if idx==0 else range(n))));ids.append(0)
    mesh(name,verts,faces,materials,ids,ws)
    return sample
def surface(sample,rows,t,z,gap=.001):
    for i in range(1,len(rows)):
        if z<=rows[i][2]:
            u=(z-rows[i-1][2])/(rows[i][2]-rows[i-1][2])
            return sample(i-1,t,gap).lerp(sample(i,t,gap),max(0,u))
    return sample(len(rows)-1,t,gap)

bone('Hips',(0,0,.79),(0,0,1.03))
bone('Spine',(0,0,1.03),(0,0,1.40),'Hips')
bone('Neck',(0,0,1.40),(0,0,1.50),'Spine')
bone('Head',(0,0,1.50),(0,0,1.70),'Neck')
core=lambda p:mix('Hips','Spine',(p.z-.87)/.20)
torso=[(0,0,z,x,y) for z,x,y in [
    (.77,.067,.075),(.83,.127,.10),(.90,.145,.106),(.98,.132,.097),(1.04,.121,.09),
    (1.10,.134,.094),(1.18,.16,.107),(1.25,.187,.124),(1.31,.201,.127),
    (1.36,.19,.108),(1.40,.146,.084),(1.43,.067,.061)]]
def suit(i,t):
    if i in (4,9,10,11):return 0
    if i<4:return 1
    front=math.cos(t)
    return 0 if front>(.72 if i<7 else .49) or front<-.58 else 1
chest=loft('Traje',torso,[red,blue],suit,core,32)
head=[(0,y,z,x,d) for z,y,x,d in [
    (1.455,-.015,.042,.050),(1.48,-.012,.062,.069),(1.512,-.008,.084,.087),
    (1.555,0,.097,.099),(1.60,.004,.104,.107),(1.645,.005,.103,.104),
    (1.683,.006,.092,.096),(1.713,.006,.065,.075),(1.729,.005,.028,.033)]]
mask=loft('Máscara',head,[red],lambda i,t:0,lambda p:rigid('Head'),28)
loft('Cuello',[(0,0,1.39,.066,.065),(0,0,1.46,.057,.062),(0,0,1.51,.061,.064)],
     [red],lambda i,t:0,lambda p:rigid('Neck'),20)
def face(t,z,gap=.001):return surface(mask,head,t,z,gap)
for j in range(12):
    t=(j+.5)*2*pi/12
    tube('Meridiano máscara',[face(t,z) for _,_,z,_,_ in head],.00135,ink,lambda p:rigid('Head'),4)
for z in [1.499,1.534,1.573,1.612,1.653,1.692]:
    tube('Arco máscara',[face((j+.5)*2*pi/12+k*pi/24,z-.007*math.sin(pi*k/4)) for j in range(12) for k in range(4)]+[face(.5*2*pi/12,z)],.0012,ink,lambda p:rigid('Head'),4)
for side in [-1,1]:
    # Narrow inner tip, high outer corner, curved lower lid.
    contour=[(.10,1.572),(.28,1.581),(.56,1.601),(.82,1.617),(1.04,1.638),
             (.98,1.601),(.82,1.576),(.62,1.554),(.42,1.550),(.23,1.557)]
    verts=[face(side*.56,1.58,.008)]
    for scale,gap in [(.77,.006),(1,.004)]:
        verts.extend(face(side*(.56+(t-.56)*scale),1.581+(z-1.581)*scale,gap) for t,z in contour)
    n=len(contour);faces=[(0,1+j,1+(j+1)%n) for j in range(n)]
    faces += [(1+j,n+1+j,n+1+(j+1)%n,1+(j+1)%n) for j in range(n)]
    if side==1:faces=[f[::-1] for f in faces]
    mesh('Lente',verts,faces,[white,ink],[0]*n+[1]*n,[rigid('Head')]*len(verts))
def front(x,z,gap=.002):
    r=surface(chest,torso,pi/2,z).x
    return surface(chest,torso,math.asin(max(-.99,min(.99,x/r))),z,gap)
for j in range(-2,3):
    tube('Radial pectoral',[surface(chest,torso,j*.34,z) for z in [1.01,1.08,1.16,1.22,1.28,1.35,1.39]],.00125,ink,core,4)
for z in [1.075,1.13,1.19,1.25,1.32,1.37]:
    tube('Arco pectoral',[surface(chest,torso,-.68+i*.085,z-.005*abs(math.sin(i*pi/4))) for i in range(17)],.0011,ink,core,4)
tube('Emblema abdomen',[front(0,1.243,.006),front(0,1.26,.007),front(0,1.278,.006)],.011,ink,core,8)
tube('Emblema cabeza',[front(0,1.278,.007),front(0,1.288,.007)],.007,ink,core,8)
for s in [-1,1]:
    for i in range(4):
        z=1.279-i*.006
        tip=1.318-i*.024
        tube('Patas del emblema',[front(s*.004,z,.007),front(s*(.020+i*.002),z+.010,.007),front(s*.039,tip,.007),front(s*.037,tip+.009*(1 if i<2 else -1),.007)],.0023,ink,core,4)
for s,side in [(-1,'Right'),(1,'Left')]:
    arm,fore,hand=[side+k for k in ('Arm','ForeArm','Hand')]
    bone(arm,(s*.17,0,1.344),(s*.303,0,1.127),'Spine')
    bone(fore,(s*.303,0,1.127),(s*.405,-.018,.95),arm)
    bone(hand,(s*.405,-.018,.95),(s*.441,-.025,.878),fore)
    def aw(p):
        if p.z<.975:return mix(hand,fore,(p.z-.93)/.045)
        return mix(fore,arm,(p.z-1.095)/.065)
    armrows=[(s*x,y,z,rx,ry) for x,y,z,rx,ry in [
        (.408,-.018,.938,.028,.024),(.391,-.018,.982,.034,.034),(.367,-.014,1.026,.043,.041),
        (.340,-.010,1.078,.046,.046),(.303,0,1.127,.040,.043),(.274,-.005,1.179,.052,.056),
        (.243,-.003,1.235,.056,.060),(.207,0,1.291,.065,.067),(.180,0,1.344,.062,.062),(.171,0,1.382,.028,.033)]]
    loft(side+' manga',armrows,[red,blue],lambda i,t:0 if i<3 or i>=8 or s*math.sin(t)>.87 else 1,aw,16)
    palm=V((s*.423,-.02,.913))
    loft('Guante',[(s*.437,-.025,.876,.033,.022),(*palm,.036,.026),(s*.408,-.018,.951,.026,.023)],
         [red],lambda i,t:0,lambda p:rigid(hand),14)
    for i in range(4):
        x=s*(.421+i*.012);extended=side=='Right' and i in (0,3)
        tube('Dedo',[V((x,-.026,.889)),V((x+s*.006,-.031,.869)),
             V((x+s*.015,-.043,.837)) if extended else V((x+s*.004,-.052,.871))],.0078,red,lambda p:rigid(hand),7)
    tube('Pulgar',[(s*.404,-.025,.922),(s*.39,-.045,.905),(s*.39,-.051,.885)],.010,red,lambda p:rigid(hand),7)
    thigh,shin,foot=[side+k for k in ('UpLeg','Leg','Foot')]
    bone(thigh,(s*.088,0,.85),(s*.126,-.011,.479),'Hips')
    bone(shin,(s*.126,-.011,.479),(s*.153,0,.10),thigh)
    bone(foot,(s*.153,0,.10),(s*.153,-.135,.054),shin)
    def lw(p):
        if p.z<.13:return mix(foot,shin,(p.z-.075)/.055)
        return mix(shin,thigh,(p.z-.438)/.08)
    leg=[(s*x,y,z,rx,ry) for x,y,z,rx,ry in [
        (.153,-.057,.024,.049,.110),(.153,-.058,.049,.051,.112),(.153,-.034,.078,.044,.085),
        (.153,0,.115,.034,.039),(.149,.009,.184,.04,.047),(.145,.017,.263,.054,.062),
        (.141,.014,.321,.059,.066),(.138,.005,.368,.054,.060),(.132,-.006,.424,.043,.047),
        (.126,-.012,.48,.051,.060),(.118,-.010,.548,.060,.069),(.110,-.003,.627,.072,.085),
        (.10,.003,.716,.079,.093),(.088,.003,.802,.080,.093),(.078,0,.857,.067,.077)]]
    boot=loft(side+' pierna',leg,[red,blue],lambda i,t:0 if i<=6 else 1,lw,18)
    for t in [-.75,0,.75]:
        tube('Costura de bota',[boot(i,t,.0009) for i in range(2,7)],.0011,ink,lw,4)

armature=bpy.data.armatures.new('Spider-Man')
rig=bpy.data.objects.new('Spider-Man',armature);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in skeleton.items():
    eb=armature.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
body=bpy.context.object;body.name='Traje clásico'
mod=body.modifiers.new('Rig de combate','ARMATURE');mod.object=rig;body.parent=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',export_yup=True)
