// The route line's walked part in another colour (D59 point 5, v2-B7): a patch for three's basic material shader, so the
// line keeps the haze. It anchors on lines of three's own shader text; walked-shader.test.ts runs it on the installed
// three's, so an upgrade that moves them fails a test instead of silently dropping the grey.

/** The part of a shader `onBeforeCompile` hands over that the patch reads and writes. */
export interface PatchableShader {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

/** Where the new declarations go, in both stages. */
const COMMON = '#include <common>';
/** meshbasic's vertex line after which the vertex is placed, and its fragment line that starts the colour. */
const AFTER_VERTEX = '#include <begin_vertex>';
const DIFFUSE = 'vec4 diffuseColor = vec4( diffuse, opacity );';

function insertAfter(source: string, anchor: string, text: string): string {
  if (!source.includes(anchor)) throw new Error(`walked shader: "${anchor}" is not in three's shader`);
  return source.replace(anchor, `${anchor}\n${text}`);
}

/**
 * Patches a basic material's shader so that where a fragment's distance along the route (the `along` vertex attribute,
 * from `ribbonAlong`) is under `walked.value` meters, it takes `walkedColor.value` (a linear three `Color`, as three
 * converts `diffuse`). Both are uniform objects the shader reads at draw time. Throws if three's shader has moved on.
 */
export function patchWalkedShader(
  shader: PatchableShader,
  walked: { value: number },
  walkedColor: { value: unknown },
): void {
  shader.uniforms.walked = walked;
  shader.uniforms.walkedColor = walkedColor;
  const vertex = insertAfter(shader.vertexShader, COMMON, 'attribute float along;\nvarying float vAlong;');
  shader.vertexShader = insertAfter(vertex, AFTER_VERTEX, 'vAlong = along;');
  const fragment = insertAfter(
    shader.fragmentShader,
    COMMON,
    'uniform float walked;\nuniform vec3 walkedColor;\nvarying float vAlong;',
  );
  shader.fragmentShader = insertAfter(fragment, DIFFUSE, 'if ( vAlong < walked ) diffuseColor.rgb = walkedColor;');
}
