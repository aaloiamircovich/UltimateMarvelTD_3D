"""Prueba técnica reproducible de Blender → GLB. No es un héroe terminado."""
import argparse
import math
from pathlib import Path
import sys
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, location=(0, 0, 1))
mesh = bpy.context.object
mesh.name = 'Prueba_Malla'
mesh.scale = (0.55, 0.4, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
material = bpy.data.materials.new('PBR_Cian')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (0.025, 0.45, 0.7, 1)
shader.inputs['Metallic'].default_value = 0.5
shader.inputs['Roughness'].default_value = 0.32
mesh.data.materials.append(material)
for face in mesh.data.polygons:
    face.use_smooth = True

bpy.ops.object.armature_add(location=(0, 0, 0))
rig = bpy.context.object
rig.name = 'Prueba_Esqueleto'
rig.data.bones[0].name = 'Root'
group = mesh.vertex_groups.new(name='Root')
group.add(list(range(len(mesh.data.vertices))), 1.0, 'REPLACE')
modifier = mesh.modifiers.new('Rig', 'ARMATURE')
modifier.object = rig
mesh.parent = rig
bone = rig.pose.bones['Root']
bone.rotation_mode = 'XYZ'
for frame, angle in [(1, 0), (16, 0.12), (31, 0), (46, -0.12), (61, 0)]:
    bone.rotation_euler.y = angle
    bone.keyframe_insert(data_path='rotation_euler', frame=frame)
rig.animation_data.action.name = 'Idle'
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 61
bpy.context.scene.render.fps = 30
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'fixture.blend'))
bpy.ops.export_scene.gltf(filepath=str(output / 'fixture.glb'), export_format='GLB',
                          export_animations=True, export_yup=True)
print('Prueba técnica exportada: fixture.blend + fixture.glb (piel, material PBR y animación Idle).')
