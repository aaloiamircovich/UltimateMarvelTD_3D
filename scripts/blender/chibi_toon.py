"""Base chibi para Blender 4.2+ / EEVEE. Ver docs/BLENDER.md.

Ejecutar desde Scripting > Run Script. No guarda archivos ni modifica el juego.
"""
import math

import bpy
from mathutils import Vector

SCENE_NAME = "TD_Chibi_Preview"
OWNER_KEY = "td_chibi_generator"
OWNER = "ultimate_marvel_td_v1"
BASE_COLOR = (0.8, 0.2, 0.2, 1.0)
SHADOW_COLOR = (0.15, 0.06, 0.10, 1.0)
LIGHT_COLOR = (1.0, 0.46, 0.32, 1.0)
OUTLINE_WIDTH = 0.03
CAMERA_TILT = 55.0
CAMERA_AZIMUTH = 45.0
CAMERA_SCALE = 5.4


def owned(block):
    block[OWNER_KEY] = OWNER
    return block


def prepare_scene():
    """Regenera sólo objetos propios enlazados directamente a la escena de trabajo."""
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene is None:
        scene = owned(bpy.data.scenes.new(SCENE_NAME))
    elif scene.get(OWNER_KEY) != OWNER:
        raise RuntimeError(f"Ya existe una escena ajena llamada {SCENE_NAME}; renombrarla primero.")
    for obj in list(scene.collection.objects):
        if obj.get(OWNER_KEY) == OWNER:
            scene.collection.objects.unlink(obj)
            if not obj.users_collection:
                bpy.data.objects.remove(obj)
    for blocks in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for block in list(blocks):
            if block.get(OWNER_KEY) == OWNER and block.users == 0:
                blocks.remove(block)
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    if scene.world is None or scene.world.get(OWNER_KEY) != OWNER:
        scene.world = owned(bpy.data.worlds.new("TD_Chibi_World"))
    world = scene.world
    world.use_nodes = True
    world.node_tree.nodes.clear()
    background = world.node_tree.nodes.new('ShaderNodeBackground')
    background.inputs['Color'].default_value = (0.055, 0.075, 0.12, 1)
    background.inputs['Strength'].default_value = 0.35
    output = world.node_tree.nodes.new('ShaderNodeOutputWorld')
    world.node_tree.links.new(background.outputs['Background'], output.inputs['Surface'])
    return scene


def material(name):
    """Reutiliza materiales propios sin acumular sufijos en cada ejecución."""
    mat = next((item for item in bpy.data.materials
                if item.get(OWNER_KEY) == OWNER and item.get('td_role') == name), None)
    if mat is None:
        mat = owned(bpy.data.materials.new(name))
        mat['td_role'] = name
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    return mat


def create_toon_material():
    """Diffuse blanco → Shader to RGB → rampa constante → Emission → Surface."""
    mat = material("TD_Toon_Anime")
    mat.diffuse_color = BASE_COLOR
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.location = (-600, 0)
    diffuse.inputs['Color'].default_value = (1, 1, 1, 1)
    rgb = nodes.new('ShaderNodeShaderToRGB')
    rgb.location = (-380, 0)
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.location = (-160, 0)
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0
    ramp.color_ramp.elements[0].color = SHADOW_COLOR
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = LIGHT_COLOR
    ramp.color_ramp.elements.new(0.3).color = BASE_COLOR
    emission = nodes.new('ShaderNodeEmission')
    emission.location = (120, 0)
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (340, 0)
    links.new(diffuse.outputs['BSDF'], rgb.inputs['Shader'])
    links.new(rgb.outputs['Color'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], emission.inputs['Color'])
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    return mat


def create_outline_material():
    mat = material("TD_Toon_Outline")
    mat.diffuse_color = (0, 0, 0, 1)
    mat.use_backface_culling = True
    # blend_method no es necesario para un material opaco y cambió en Blender 4.2.
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (0, 0, 0, 1)
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    return mat


def finish_part(scene, name, toon, outline):
    obj = owned(bpy.context.object)
    obj.name = name
    owned(obj.data)
    # Siempre enlazar al nivel raíz, incluso si el usuario seleccionó otra colección.
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    scene.collection.objects.link(obj)
    obj.data.materials.append(toon)
    obj.data.materials.append(outline)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    modifier = obj.modifiers.new(name="Contorno cómic", type='SOLIDIFY')
    modifier.thickness = OUTLINE_WIDTH
    modifier.offset = 1
    modifier.use_rim = False  # Las primitivas son superficies cerradas.
    modifier.use_flip_normals = True
    modifier.material_offset = 1
    return obj


def build_chibi_base_mesh(scene, toon, outline):
    parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12, ring_count=8, radius=1, location=(0, 0, 2.5))
    parts.append(finish_part(scene, "Hero_Head", toon, outline))
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.6, radius2=0.2, depth=1.2, location=(0, 0, 1.4))
    parts.append(finish_part(scene, "Hero_Body", toon, outline))
    for name, location in {
        "Leg_L": (-0.35, 0, 0.4), "Leg_R": (0.35, 0, 0.4),
        "Arm_L": (-0.75, 0, 1.5), "Arm_R": (0.75, 0, 1.5),
    }.items():
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=6, radius=0.15, depth=0.7, location=location)
        parts.append(finish_part(scene, f"Hero_{name}", toon, outline))
    return parts


def add_object(scene, name, data, location):
    obj = owned(bpy.data.objects.new(name, owned(data)))
    scene.collection.objects.link(obj)
    obj.location = location
    return obj


def create_camera_and_light(scene):
    camera = add_object(scene, "Camera_TD_Orthographic",
                        bpy.data.cameras.new("TD_Camera"), (0, 0, 0))
    camera.rotation_euler = (math.radians(CAMERA_TILT), 0, math.radians(CAMERA_AZIMUTH))
    # Derivar la posición desde la rotación centra el personaje en el encuadre.
    camera.location = (Vector((0, 0, 1.75))
                       + camera.rotation_euler.to_matrix() @ Vector((0, 0, 20)))
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = CAMERA_SCALE
    scene.camera = camera
    light = add_object(scene, "TD_Key_Light",
                       bpy.data.lights.new("TD_Sun", type='SUN'), (4, -6, 8))
    light.rotation_euler = (math.radians(25), math.radians(-30), math.radians(-25))
    light.data.energy = 2
    light.data.angle = math.radians(5)


def report_geometry(parts, depsgraph):
    """Cuenta triángulos reales, incluyendo el coste del contorno evaluado."""
    faces = triangles = evaluated_triangles = 0
    for obj in parts:
        obj.data.calc_loop_triangles()
        faces += len(obj.data.polygons)
        triangles += len(obj.data.loop_triangles)
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            evaluated_triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    print(f"Base chibi lista: {len(parts)} piezas, {faces} caras, "
          f"{triangles} triángulos base; {evaluated_triangles} con contorno.")


def main():
    if bpy.app.version < (4, 2, 0):
        raise RuntimeError("Este script requiere Blender 4.2 o posterior con EEVEE.")
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        raise RuntimeError("Cambiar a Object Mode antes de ejecutar el generador.")
    scene = prepare_scene()
    if bpy.context.window:
        bpy.context.window.scene = scene
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        parts = build_chibi_base_mesh(scene, create_toon_material(), create_outline_material())
        create_camera_and_light(scene)
        bpy.context.view_layer.update()
        report_geometry(parts, bpy.context.evaluated_depsgraph_get())
    print(f"Escena {SCENE_NAME} preparada. F12: render. Guardar el .blend manualmente.")


if __name__ == '__main__':
    main()
