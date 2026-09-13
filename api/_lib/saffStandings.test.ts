import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficialStandings } from './saffStandings';

test('parses the official SAFF standing table without recalculating values', () => {
  const html = `
    <div id="standing" class="p-2 rounded" style="background-color:white">
      <p>Standing of Women's Premier League U-17</p>
      <table>
        <thead><tr><th></th><th></th><th></th><th></th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>+/-</th><th>Pts</th></tr></thead>
        <tbody>
          <tr><td></td><td>1</td><td><img src="team.png"></td><td><a href="team.php?id=1">Al Hilal</a></td><td>1</td><td>1</td><td>0</td><td>0</td><td>19</td><td>0</td><td>+19</td><td>3</td></tr>
          <tr><td></td><td>4</td><td><img src="team.png"></td><td><a href="team.php?id=121">AlUla</a></td><td>1</td><td>1</td><td>0</td><td>0</td><td>2</td><td>0</td><td>+2</td><td>3</td></tr>
        </tbody>
      </table>
    </div>
    <div id="fixtures"></div>`;

  assert.deepEqual(parseOfficialStandings(html), [
    {
      position: 1,
      team: 'Al Hilal',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 19,
      goalsAgainst: 0,
      goalDifference: 19,
      points: 3
    },
    {
      position: 4,
      team: 'AlUla',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 0,
      goalDifference: 2,
      points: 3
    }
  ]);
});
