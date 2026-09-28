import {
  BlurMask,
  Canvas,
  Group,
  Oval,
  Path,
  RadialGradient,
  Shadow,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import {
  Easing,
  interpolateColor,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export type OrbPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

type VoiceOrbProps = {
  phase: OrbPhase;
  muted?: boolean;
  /** Mic loudness 0–1; swells the orb while listening. */
  level: SharedValue<number>;
  size?: number;
};

// "Living blob" from the approved design (Voice.dc.html): a glossy teal shape whose outline
// keeps shifting, with a paler shape behind. Per phase it breathes (listening), shrinks and
// turns (thinking), or pulses like speech (speaking); muted greys it out and freezes it.
const PHASES = {
  idle: { speed: 0.5, wobble: 0.05, scale: 1, spin: 0 },
  listening: { speed: 0.8, wobble: 0.06, scale: 1, spin: 0 },
  thinking: { speed: 2.2, wobble: 0.07, scale: 0.88, spin: 0.9 },
  speaking: { speed: 2.4, wobble: 0.09, scale: 1, spin: 0 },
} as const;

const TEAL = { light: '#6CC7B3', mid: '#28786C', deep: '#123F39', back: '#A8E2D3' };
const GREY = { light: '#C9CFD6', mid: '#8A93A0', deep: '#566170', back: '#D5DAE0' };
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const POINTS = 8;

export function VoiceOrb({ phase, muted = false, level, size = 220 }: VoiceOrbProps) {
  const reduced = useReducedMotion();
  const center = size / 2;
  const frontRadius = size * 0.39;
  const backRadius = size * 0.445;

  // Phase settings are eased, so switching state never snaps.
  const speed = useSharedValue<number>(PHASES[phase].speed);
  const wobble = useSharedValue<number>(PHASES[phase].wobble);
  const baseScale = useSharedValue<number>(PHASES[phase].scale);
  const spinRate = useSharedValue<number>(PHASES[phase].spin);
  const talking = useSharedValue(phase === 'speaking' ? 1 : 0);
  const grey = useSharedValue(muted ? 1 : 0);
  const time = useSharedValue(0);
  const angle = useSharedValue(0);

  useEffect(() => {
    const target = PHASES[phase];
    const frozen = muted || reduced;
    const config = { duration: 500, easing: EASE_IN_OUT };
    speed.set(withTiming(frozen ? 0 : target.speed, config));
    wobble.set(withTiming(reduced ? 0.03 : target.wobble, config));
    baseScale.set(withTiming(target.scale, config));
    spinRate.set(withTiming(frozen ? 0 : target.spin, config));
    talking.set(withTiming(phase === 'speaking' && !frozen ? 1 : 0, config));
    grey.set(withTiming(muted ? 1 : 0, { duration: 400 }));
  }, [phase, muted, reduced, speed, wobble, baseScale, spinRate, talking, grey]);

  useFrameCallback((frame) => {
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    time.set(time.get() + dt * speed.get());
    angle.set(angle.get() + dt * spinRate.get());
  });

  // A fresh path per frame from an SVG string. Skia's usePathValue keeps one PathBuilder host
  // object alive across frames, and a frame that runs while the screen unmounts can touch it
  // after it was freed (native crash on Android).
  const front = useDerivedValue(
    () => Skia.Path.MakeFromSVGString(blob(center, center, frontRadius, wobble.get(), time.get(), 0)) ?? Skia.Path.Make()
  );
  const back = useDerivedValue(
    () =>
      Skia.Path.MakeFromSVGString(blob(center, center, backRadius, wobble.get() * 1.2, time.get() * 0.7, 2.1)) ??
      Skia.Path.Make()
  );

  const transform = useDerivedValue(() => {
    const t = time.get();
    // Irregular two-sine bounce reads as speech rather than a metronome.
    const talk = talking.get() * 0.04 * (0.5 + 0.5 * Math.sin(t * 7.3)) * (0.6 + 0.4 * Math.sin(t * 3.1));
    const breathe = 0.02 * Math.sin(t * 1.4);
    const listen = muted ? 0 : level.get() * 0.1;
    const scale = baseScale.get() + breathe + listen + talk;
    return [{ rotate: angle.get() }, { scale }];
  });

  const gradient = useDerivedValue(() => {
    const g = grey.get();
    return [
      interpolateColor(g, [0, 1], [TEAL.light, GREY.light]),
      interpolateColor(g, [0, 1], [TEAL.mid, GREY.mid]),
      interpolateColor(g, [0, 1], [TEAL.deep, GREY.deep]),
    ];
  });
  const backColor = useDerivedValue(() => interpolateColor(grey.get(), [0, 1], [TEAL.back, GREY.back]));

  return (
    <Canvas style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <Group origin={vec(center, center)} transform={transform}>
        <Path path={back} color={backColor} opacity={0.5} />
        <Path path={front}>
          <RadialGradient
            c={vec(center - frontRadius * 0.4, center - frontRadius * 0.44)}
            r={frontRadius * 1.9}
            colors={gradient}
            positions={[0, 0.45, 1]}
          />
          <Shadow dx={0} dy={14} blur={18} color="rgba(19, 74, 67, 0.35)" />
        </Path>
        <Oval
          x={center - frontRadius * 0.62}
          y={center - frontRadius * 0.74}
          width={frontRadius * 0.72}
          height={frontRadius * 0.4}
          color="rgba(255, 255, 255, 0.35)"
          transform={[{ rotate: -0.49 }]}
          origin={vec(center - frontRadius * 0.26, center - frontRadius * 0.54)}>
          <BlurMask blur={9} style="normal" />
        </Oval>
      </Group>
    </Canvas>
  );
}

/** SVG path of a closed smooth shape through POINTS radii that drift independently over time. */
function blob(
  cx: number,
  cy: number,
  radius: number,
  wobble: number,
  t: number,
  seed: number
) {
  'worklet';
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    const a = (i / POINTS) * Math.PI * 2;
    const drift =
      Math.sin(t * (0.9 + i * 0.13) + i * 1.7 + seed) * 0.6 + Math.sin(t * (0.5 + i * 0.07) + i * 2.9 + seed) * 0.4;
    const r = radius * (1 + wobble * drift);
    xs.push(cx + Math.cos(a) * r);
    ys.push(cy + Math.sin(a) * r);
  }
  // Catmull-Rom through the points, expressed as cubic Béziers.
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(xs[0])} ${f(ys[0])}`;
  for (let i = 0; i < POINTS; i++) {
    const p0 = (i - 1 + POINTS) % POINTS;
    const p2 = (i + 1) % POINTS;
    const p3 = (i + 2) % POINTS;
    d +=
      ` C${f(xs[i] + (xs[p2] - xs[p0]) / 6)} ${f(ys[i] + (ys[p2] - ys[p0]) / 6)}` +
      ` ${f(xs[p2] - (xs[p3] - xs[i]) / 6)} ${f(ys[p2] - (ys[p3] - ys[i]) / 6)}` +
      ` ${f(xs[p2])} ${f(ys[p2])}`;
  }
  return `${d} Z`;
}
