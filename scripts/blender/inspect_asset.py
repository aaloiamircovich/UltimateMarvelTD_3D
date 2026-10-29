"""Inspección y render de GLB en un proceso aislado; nunca modifica el original."""
import argparse
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source, output = Path(args.input), Path(args.output)
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
scene = bpy.context.scene
# The glTF importer may add mesh widgets to display bones in the editor.
# Those are not model geometry and must not inflate budgets or framing.
bone_widgets = {bone.custom_shape for obj in scene.objects if obj.type == 'ARMATURE'
                for bone in obj.pose.bones if bone.custom_shape}
meshes = [obj for obj in scene.objects if obj.type == 'MESH'
          and not obj.hide_render and obj not in bone_widgets]
if not meshes:
    raise RuntimeError('El archivo no contiene mallas visibles.')
triangles = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector(tuple(min(p[i] for p in points) for i in range(3)))
maximum = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center, size = (minimum + maximum) / 2, maximum - minimum
bones = sum(len(obj.data.bones) for obj in scene.objects if obj.type == 'ARMATURE')
warnings = []
if triangles > 3000:
    warnings.append('Supera el presupuesto inicial de 3.000 triángulos por héroe; revisar LOD y rendimiento.')
if bones > 30:
    warnings.append('Supera la guía inicial de 30 huesos; revisar antes de desplegar muchas unidades.')
report = {'archivo': source.name, 'blender': bpy.app.version_string, 'mallas': len(meshes),
          'triangulos': triangles, 'huesos': bones, 'materiales': len(bpy.data.materials),
          'animaciones': [action.name for action in bpy.data.actions],
          'dimensiones': list(size), 'minimo': list(minimum),
          'texturas': [{'nombre': image.name, 'ancho': image.size[0], 'alto': image.size[1]}
                       for image in bpy.data.images], 'observaciones': warnings}
report_path = output / f'{source.stem}.json'
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

camera_data = bpy.data.cameras.new('Camara_revision')
camera = bpy.data.objects.new('Camara_revision', camera_data)
scene.collection.objects.link(camera)
extent = max(max(size), 0.1)
camera.location = center + Vector((1.4, -2.5, 1.0)).normalized() * extent * 3
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = extent * 1.5
scene.camera = camera
for name, offset, energy, color in [('Principal', (2, -3, 4), 500, (1.0, 0.88, 0.76)),
                                     ('Relleno', (-3, -1, 2), 300, (0.55, 0.8, 1.0)),
                                     ('Borde', (1, 3, 3), 500, (0.8, 0.9, 1.0))]:
    data = bpy.data.lights.new(name, 'AREA')
    lamp = bpy.data.objects.new(name, data)
    scene.collection.objects.link(lamp)
    lamp.location = center + Vector(offset) * extent
    lamp.rotation_euler = (center - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    data.energy, data.color, data.shape, data.size = energy * extent * extent, color, 'DISK', extent * 2
scene.world = bpy.data.worlds.new('Estudio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.06, 0.08, 0.12, 1)
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(output / f'{source.stem}.png')
bpy.ops.render.render(write_still=True)
print(f'Informe: {report_path}\nRender: {scene.render.filepath}')
