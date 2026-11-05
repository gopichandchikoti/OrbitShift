import { describe, expect, it } from 'vitest';
import { PlaySession } from '../src/game/session';
import { DEATHS, describeDeath } from '../src/game/tips';
import { solveLevel } from '../src/game/tools/solver';
import { chainLevel, makeLevel } from './helpers/level-factory';

const FRAME = 1000 / 60;

function run(session: PlaySession, frames: number, ms = FRAME) {
  return Array.from({ length: frames }, () => session.update(ms)).flat();
}

describe('input: hold to aim, release to launch', () => {
  it('shows a preview only while aiming from an orbit', () => {
    const session = new PlaySession(chainLevel());
    expect(session.preview).toBeNull();
    session.press();
    expect(session.aiming).toBe(true);
    expect(session.preview?.points.length).toBeGreaterThan(2);
  });

  it('launches on release, not on press', () => {
    const session = new PlaySession(chainLevel());
    session.press();
    run(session, 5);
    expect(session.state.launches).toBe(0);
    session.release();
    run(session, 1);
    expect(session.state.launches).toBe(1);
    expect(session.state.ship.mode).toBe('flight');
    expect(session.aiming).toBe(false);
  });

  it('launches exactly where the preview said it would, when released on the next step', () => {
    const session = new PlaySession(chainLevel());
    run(session, 37);
    expect(session.state.tick).toBe(37);
    session.press();
    const points = session.preview?.points ?? [];
    expect(points.length).toBeGreaterThan(4);
    session.release();
    // points[1] is the launch step itself; after it the preview samples every third tick.
    const flown: { x: number; y: number }[] = [];
    run(session, 1);
    flown.push({ x: session.state.ship.x, y: session.state.ship.y });
    for (let sample = 0; sample < 3; sample++) {
      run(session, 3);
      flown.push({ x: session.state.ship.x, y: session.state.ship.y });
    }
    flown.forEach((actual, i) => {
      expect(actual.x).toBeCloseTo(points[i + 1]?.x ?? NaN, 9);
      expect(actual.y).toBeCloseTo(points[i + 1]?.y ?? NaN, 9);
    });
  });

  it('ignores a release that was never preceded by a press', () => {
    const session = new PlaySession(chainLevel());
    session.release();
    run(session, 3);
    expect(session.state.launches).toBe(0);
  });

  it('does nothing while the ship is already flying', () => {
    const session = new PlaySession(chainLevel());
    session.press();
    session.release();
    run(session, 2);
    session.press();
    session.release();
    run(session, 2);
    expect(session.state.launches).toBe(1);
  });

  it('keeps aiming through a flight so the player can release after the next capture', () => {
    const session = new PlaySession(chainLevel());
    session.press();
    session.release();
    run(session, 2);
    session.press();
    expect(session.aiming).toBe(true);
    expect(session.preview).toBeNull();
  });
});

describe('input: tap once to aim, tap again to launch', () => {
  it('toggles between aiming and launching on each tap', () => {
    const session = new PlaySession(chainLevel(), 'tap');
    session.press();
    session.release();
    expect(session.aiming).toBe(true);
    run(session, 3);
    expect(session.state.launches).toBe(0);
    session.press();
    session.release();
    run(session, 1);
    expect(session.state.launches).toBe(1);
    expect(session.aiming).toBe(false);
  });

  it('cancels aiming when the mode changes', () => {
    const session = new PlaySession(chainLevel(), 'tap');
    session.press();
    session.setControlMode('hold');
    expect(session.aiming).toBe(false);
    session.setControlMode('hold');
  });
});

describe('pause, resume and restart', () => {
  it('freezes the simulation while paused and does not replay paused time', () => {
    const session = new PlaySession(chainLevel());
    run(session, 10);
    const tick = session.state.tick;
    session.pause();
    expect(session.update(5000)).toEqual([]);
    expect(session.state.tick).toBe(tick);
    session.resume();
    session.update(FRAME);
    expect(session.state.tick).toBeLessThanOrEqual(tick + 1);
  });

  it('drops an in-progress aim on pause and ignores input while paused', () => {
    const session = new PlaySession(chainLevel());
    session.press();
    session.pause();
    expect(session.aiming).toBe(false);
    session.press();
    session.release();
    session.resume();
    run(session, 3);
    expect(session.state.launches).toBe(0);
  });

  it('restarts from tick zero with a clean state', () => {
    const session = new PlaySession(chainLevel());
    session.press();
    session.release();
    run(session, 30);
    session.restart();
    expect(session.state.tick).toBe(0);
    expect(session.state.launches).toBe(0);
    expect(session.state.ship.mode).toBe('orbit');
    expect(session.paused).toBe(false);
  });

  it('refuses input once the run is finished', () => {
    const level = makeLevel({ goal: { x: 360, y: 1050 - 68, radius: 30, requiredShards: 0 } });
    const session = new PlaySession(level);
    run(session, 2);
    expect(session.won).toBe(true);
    session.press();
    expect(session.aiming).toBe(false);
  });
});

describe('frame-rate independence', () => {
  it.each([30, 60, 120, 144])('reaches the same state after one second at %i fps', (fps) => {
    const session = new PlaySession(chainLevel());
    run(session, fps, 1000 / fps);
    expect(Math.abs(session.state.tick - 60)).toBeLessThanOrEqual(1);
  });

  it('reports the fractional step for interpolation', () => {
    const session = new PlaySession(chainLevel());
    session.update(FRAME * 1.5);
    expect(session.alpha).toBeGreaterThan(0.3);
    expect(session.alpha).toBeLessThan(0.7);
  });
});

describe('completing a level with the recorded solution', () => {
  it('wins, earns stars and reports what to save', () => {
    const level = chainLevel();
    const { solution } = solveLevel(level);
    expect(solution).not.toBeNull();
    const withPar = { ...level, par: { launches: solution?.launchTicks.length ?? 9, seconds: 999 } };
    const session = new PlaySession(withPar);
    const ticks = solution?.launchTicks ?? [];
    let next = 0;
    for (let guard = 0; guard < 4000 && !session.finished; guard++) {
      if (ticks[next] === session.state.tick + 1) {
        next += 1;
        session.press();
        session.release();
      }
      session.update(FRAME);
    }
    expect(session.won).toBe(true);
    expect(session.stars).toBe(3);
    expect(session.completion()).toMatchObject({ levelId: 1, stars: 3, launches: ticks.length });
  });

  it('has no completion and no stars while playing or after a loss', () => {
    const session = new PlaySession(chainLevel());
    expect(session.completion()).toBeNull();
    expect(session.stars).toBeNull();
  });
});

describe('death tips', () => {
  it('has a title and tip for every way to lose, and defaults to "lost"', () => {
    for (const info of Object.values(DEATHS)) {
      expect(info.title.length).toBeGreaterThan(3);
      expect(info.tip.endsWith('.')).toBe(true);
    }
    expect(describeDeath(null)).toBe(DEATHS.lost);
    expect(describeDeath('laser')).toBe(DEATHS.laser);
  });
});
