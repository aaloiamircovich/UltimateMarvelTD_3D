"""Maqueta de producción del hangar; unidades en metros, frente hacia -Y."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/models/base-avengers-hangar-v1'
OUT.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
access_module = []

def finish(name, color, metal=0, rough=.5):
    m = bpy.data.materials.new(name)
    rgb = tuple(((int(color[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))
    m.diffuse_color = (*rgb,1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    for key,value in [('Base Color',(*rgb,1)),('Metallic',metal),('Roughness',rough)]:
        bsdf.inputs[key].default_value = value
    return m

steel = finish('Acero pavonado','344759',.55)
concrete = finish('Hormigon claro','becbd1')
roof = finish('Cubierta granate','9c3541',.35)
rib = finish('Nervadura roja','b34d55',.4)
glass = finish('Vidrio celeste','8cd1db',.25,.22)
door = finish('Porton blindado','607484',.48)
amber = finish('Baliza ambar','ffc656')
ivory = finish('Rotulo marfil','e5dfcf')
dark = finish('Caucho y juntas','25333e')
bpy.ops.object.empty_add(type='PLAIN_AXES')
root = bpy.context.object
root.name = 'Hangar_Base_Avengers'
def panel(name,loc,size,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object
    o.name=name
    o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Cantos','BEVEL')
        mod.width=bevel; mod.segments=2
        o.modifiers.new('Normales','WEIGHTED_NORMAL')
    o.parent=root
    return o

panel('Nave',(0,0,1.57),(10,5,3.14),concrete,.09)
panel('Zocalo',(0,0,.18),(10.14,5.09,.36),steel)
panel('Techo',(0,0,3.28),(10.45,5.45,.35),roof,.08)
for i in range(-12,13):
    panel('Costilla de cubierta',(i*.406,0,3.475),(.065,5.27,.08),rib)
panel('Alero continuo',(0,-2.56,2.93),(10.12,.28,.16),steel)
for side in [-1,1]:
    for i in range(3):
        panel('Vidrio superior',(side*(2.91+i*.76),-2.527,2.47),(.68,.075,.54),glass)
    casing = panel('Casete lateral',(side*2.6,-2.7,1.19),(.37,.46,2.38),steel)
    guide = panel('Guia del acceso',(side*2.6,-2.95,1.5),(.08,.07,1.32),amber)
    parts=[casing,guide]
    for z in [.23,1.99]:
        parts.append(panel('Abrazadera',(side*2.6,-2.72,z),(.41,.51,.13),door))
    for z in [.47,.61,.75]:
        parts.append(panel('Rejilla de carcasa',(side*2.6,-2.94,z),(.23,.055,.042),dark))
    if side==1:
        access_module.extend(parts)
    for i in range(4):
        panel('Panel de costado',(side*5.015,-1.81+i*1.2,1.45),(.10,1.14,2.03),concrete)
        panel('Lucernario',(side*5.08,-1.81+i*1.2,2.36),(.035,1.04,.34),glass)
    for i in range(3):
        panel('Lama de ventilacion',(side*3.88,-2.55,.86+.145*i),(1.38,.12,.055),door)
    panel('Esquina',(side*4.83,-2.53,1.39),(.21,.15,2.46),door)
panel('Marco de acceso',(0,-2.59,1.26),(4.92,.18,2.52),dark)
for i in range(9):
    panel('Hoja seccional',(0,-2.705,.16+i*.235),(4.50,.075,.215),door)
panel('Visera',(0,-2.81,2.59),(5.58,.87,.19),steel)
def lettering(body,x,z,size):
    bpy.ops.object.text_add(location=(x,-2.76,z),rotation=(math.pi/2,0,0))
    o=bpy.context.object;o.name='Identificacion '+body;o.data.body=body
    o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.006;o.data.materials.append(ivory)
    bpy.ops.object.convert(target='MESH');bpy.context.object.parent=root
lettering('A',0,1.02,.87)
lettering('H A N G A R   /   0 1',0,.65,.18)
bpy.ops.export_scene.gltf(filepath=str(OUT/'hangar.glb'),export_format='GLB',export_apply=True)
scene.render.engine='CYCLES'; scene.cycles.samples=8; scene.cycles.use_denoising=True
scene.world=bpy.data.worlds.new('Cielo');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.69,.85,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
def area(loc,power,size):
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object
    o.data.energy=power;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
area((-5,-7,11),1600,8);area((6,3,8),1250,6)
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera
def shot(file,loc,target,width,height,scale):
    camera.location=loc
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=scale
    scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
    scene.render.filepath=str(OUT/file);bpy.ops.render.render(write_still=True)
panel('Piso de estudio',(0,0,-.18),(200,200,.34),finish('Pista','65757c'))
for o in root.children:
    o.hide_render=o not in access_module and o.name!='Piso de estudio'
shot('acceso-tres-cuartos.png',(5.4,-7,2.95),(2.6,-2.7,1.19),540,720,3.1)
for o in root.children:o.hide_render=False
shot('hangar.png',(9,-16,9),(0,0,1.45),960,620,14.6)
# Silueta de aproximacion en la via, externa al GLB del hangar.
for x in range(-10,11,2):
    panel('Marca vial',(x,-5,.005),(1.15,.10,.016),ivory,0)
def import_actor(file,x,y,height):
    bpy.ops.import_scene.gltf(filepath=str(file))
    objects=list(bpy.context.selected_objects)
    mesh=[o for o in objects if o.type=='MESH']
    pts=[o.matrix_world @ Vector(c) for o in mesh for c in o.bound_box]
    floor=min(p.z for p in pts); k=height/(max(p.z for p in pts)-floor)
    anchor=bpy.data.objects.new('Escala de personaje',None);scene.collection.objects.link(anchor)
    for o in objects:
        if not o.parent:o.parent=anchor
    anchor.scale=(k,k,k);anchor.location=(x,y,-floor*k)
import_actor(ROOT/'art/models/iron-man-mark-vii-v1/model.glb',2,-3.9,1.88)
widow=ROOT/'art/models/black-widow-v1/model.glb'
if widow.exists():import_actor(widow,-.55,-3.9,1.70)
shot('escala-tactica.png',(8,-15,13),(0,-.75,1.5),960,620,18.1)
