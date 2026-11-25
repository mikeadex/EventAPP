import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { zonedInstant } from './zoned-time.ts';

const iso = (date: string, time: string, zone: string) => zonedInstant(date, time, zone).toISOString();

/** Wall-clock HH:mm in `zone` at instant `d`. */
const wallIn = (d: Date, zone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

describe('zonedInstant', () => {
  describe('America/New_York (2027: EDT from 14 Mar, EST from 7 Nov)', () => {
    const NY = 'America/New_York';
    it('reads winter and summer times at -5 and -4', () => {
      assert.equal(iso('2027-01-15', '10:00', NY), '2027-01-15T15:00:00.000Z');
      assert.equal(iso('2027-07-01', '19:00', NY), '2027-07-01T23:00:00.000Z');
    });
    it('the day clocks go forward: before at -5, after at -4', () => {
      assert.equal(iso('2027-03-13', '12:00', NY), '2027-03-13T17:00:00.000Z');
      assert.equal(iso('2027-03-14', '01:30', NY), '2027-03-14T06:30:00.000Z');
      assert.equal(iso('2027-03-14', '03:00', NY), '2027-03-14T07:00:00.000Z');
      assert.equal(iso('2027-03-14', '10:00', NY), '2027-03-14T14:00:00.000Z');
    });
    it('the day clocks go back: before at -4, after at -5', () => {
      assert.equal(iso('2027-11-07', '00:30', NY), '2027-11-07T04:30:00.000Z');
      assert.equal(iso('2027-11-07', '02:00', NY), '2027-11-07T07:00:00.000Z');
      assert.equal(iso('2027-11-07', '12:00', NY), '2027-11-07T17:00:00.000Z');
    });
    it('a time skipped by the change lands an hour either side of it', () => {
      const d = zonedInstant('2027-03-14', '02:30', NY);
      assert.ok(['01:30', '03:30'].includes(wallIn(d, NY)), wallIn(d, NY));
    });
    it('a time that happens twice resolves to one of its two instants', () => {
      const d = zonedInstant('2027-11-07', '01:30', NY).toISOString();
      assert.ok(['2027-11-07T05:30:00.000Z', '2027-11-07T06:30:00.000Z'].includes(d), d);
    });
    it('rolls a late start across midnight UTC', () => {
      assert.equal(iso('2027-12-31', '22:00', NY), '2028-01-01T03:00:00.000Z');
    });
  });

  describe('Europe/London (2027: BST 28 Mar – 31 Oct)', () => {
    const LDN = 'Europe/London';
    it('is UTC in winter and +1 in summer', () => {
      assert.equal(iso('2027-01-15', '10:00', LDN), '2027-01-15T10:00:00.000Z');
      assert.equal(iso('2027-06-01', '10:00', LDN), '2027-06-01T09:00:00.000Z');
    });
    it('either side of both changes', () => {
      assert.equal(iso('2027-03-28', '00:30', LDN), '2027-03-28T00:30:00.000Z');
      assert.equal(iso('2027-03-28', '10:00', LDN), '2027-03-28T09:00:00.000Z');
      assert.equal(iso('2027-10-31', '00:30', LDN), '2027-10-30T23:30:00.000Z');
      assert.equal(iso('2027-10-31', '10:00', LDN), '2027-10-31T10:00:00.000Z');
    });
    it('a skipped time lands an hour either side; a repeated one on one of its instants', () => {
      const skipped = zonedInstant('2027-03-28', '01:30', LDN);
      assert.ok(['00:30', '02:30'].includes(wallIn(skipped, LDN)), wallIn(skipped, LDN));
      const twice = iso('2027-10-31', '01:30', LDN);
      assert.ok(['2027-10-31T00:30:00.000Z', '2027-10-31T01:30:00.000Z'].includes(twice), twice);
    });
  });

  describe('Europe/Dublin (winter time is the "negative DST" in tzdata)', () => {
    const DUB = 'Europe/Dublin';
    it('reads like London: UTC in winter, +1 in summer', () => {
      assert.equal(iso('2027-01-15', '10:00', DUB), '2027-01-15T10:00:00.000Z');
      assert.equal(iso('2027-06-01', '10:00', DUB), '2027-06-01T09:00:00.000Z');
      assert.equal(iso('2027-03-28', '10:00', DUB), '2027-03-28T09:00:00.000Z');
      assert.equal(iso('2027-10-31', '10:00', DUB), '2027-10-31T10:00:00.000Z');
    });
  });

  describe('Pacific/Honolulu (no daylight saving)', () => {
    const HNL = 'Pacific/Honolulu';
    it('is -10 all year, including on the US change days', () => {
      assert.equal(iso('2027-01-15', '10:00', HNL), '2027-01-15T20:00:00.000Z');
      assert.equal(iso('2027-03-14', '02:30', HNL), '2027-03-14T12:30:00.000Z');
      assert.equal(iso('2027-11-07', '01:30', HNL), '2027-11-07T11:30:00.000Z');
      assert.equal(iso('2027-07-01', '18:00', HNL), '2027-07-02T04:00:00.000Z');
    });
  });
});
