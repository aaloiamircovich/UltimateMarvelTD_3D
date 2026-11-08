import * as THREE from "three";

const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

// Lenguas de fuego sin texturas externas. El reloj pertenece a la simulación.
export function attachTorchFlames(root, model) {
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, strength: { value: 1 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float strength;
      void main(){
        float y=vUv.y;
        float wave=sin(y*13.-time*8.)*.09+sin(y*25.-time*11.)*.035;
        float x=abs(vUv.x-.5-wave*y);
        float width=(1.-y)*.40+.035*sin(y*31.-time*9.);
        float edge=1.-smoothstep(width-.08,width+.025,x);
        float alpha=edge*smoothstep(0.,.14,y)*(1.-smoothstep(.78,1.,y));
        if(alpha<.02)discard;
        vec3 color=mix(vec3(1.,.12,.005),vec3(1.,.88,.24),pow(max(0.,1.-x*5.),2.)*(1.-y));
        gl_FragColor=vec4(color,alpha*.8*strength);
      }`,
  });
  const anchors = [
    ["RightHand", .44, .68], ["LeftHand", .40, .58],
    ["RightFoot", .35, .64], ["LeftFoot", .35, .64], ["Head", .34, .46],
  ].map(([name, width, height]) => {
    const bone = model.getObjectByName(name), group = new THREE.Group();
    group.name = `Llama_${name}`;
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(geometry, material);
      flame.rotation.y = i * Math.PI / 3;
      flame.scale.set(width, height, 1); flame.position.y = height * .40;
      flame.frustumCulled = false; group.add(flame);
    }
    root.add(group);
    return { bone, group, offset: name === "Head" ? .32 : 0 };
  });
  root.userData.disposeEffects = () => material.dispose();
  root.userData.flameMaterial = material;
  return (time, shot, stunned) => {
    material.uniforms.time.value = time;
    material.uniforms.strength.value = stunned ? .35 : 1 + shot * .35;
    root.updateWorldMatrix(true, true);
    for (const { bone, group, offset } of anchors) {
      group.visible = Boolean(bone);
      if (bone) {
        bone.getWorldPosition(group.position);
        root.worldToLocal(group.position);
        group.position.y += offset;
        group.rotation.y = -root.rotation.y;
      }
    }
  };
}
