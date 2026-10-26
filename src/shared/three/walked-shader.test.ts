import { Color, ShaderLib } from 'three';
import { describe, expect, it } from 'vitest';
import { patchWalkedShader } from './walked-shader';

const basic = () => ({
  uniforms: {},
  vertexShader: ShaderLib.basic.vertexShader,
  fragmentShader: ShaderLib.basic.fragmentShader,
});

describe('patchWalkedShader', () => {
  it("finds its anchors in the installed three's basic shader", () => {
    const shader = basic();
    const walked = { value: 12 };
    const colour = { value: new Color('#686b6a') };
    patchWalkedShader(shader, walked, colour);
    expect(shader.vertexShader).toContain('#include <begin_vertex>\nvAlong = along;');
    expect(shader.vertexShader).toContain('attribute float along;');
    expect(shader.fragmentShader).toContain(
      'vec4 diffuseColor = vec4( diffuse, opacity );\nif ( vAlong < walked ) diffuseColor.rgb = walkedColor;',
    );
    expect(shader.fragmentShader).toContain('uniform float walked;\nuniform vec3 walkedColor;\nvarying float vAlong;');
  });

  it('hands the shader the very uniform objects, so a later value is read at draw time', () => {
    const shader = basic();
    const walked = { value: 0 };
    const colour = { value: new Color() };
    patchWalkedShader(shader, walked, colour);
    expect(shader.uniforms).toEqual({ walked, walkedColor: colour });
    expect((shader.uniforms as Record<string, unknown>).walked).toBe(walked);
  });

  it('throws when an anchor is missing, instead of silently drawing no grey', () => {
    const shader = { ...basic(), fragmentShader: 'void main() {}' };
    expect(() => {
      patchWalkedShader(shader, { value: 0 }, { value: new Color() });
    }).toThrow('walked shader: "#include <common>" is not in three\'s shader');
  });
});
