// Adapted from GameLoop.generateLevelMap/seededNoise/paintPathTiles at
// TowerDefense_Marvel 84797a5a0c0f344145a7b3442b02e46f13ebdb8b.
// Sanctum has waterBand=false and uses the original 800x600 canvas, 40px cells.
export function sanctumTerrain(path) {
  const size = 40, cols = 20, rows = 15;
  const terrain = Array.from({length:rows}, (_,y) => Array.from({length:cols}, (_,x) => {
    const value = Math.sin((x+1)*12.9898+(y+1)*78.233)*43758.5453;
    const noise = value-Math.floor(value);
    let cell = noise < .05 ? 11 : noise < .13 ? 12 : noise < .18 ? 4 : 1;
    if (y===0 || y===rows-1 || (x<2 && y<5)) cell=3;
    return cell;
  }));
  for(let i=0;i<path.length-1;i++) {
    const startX=Math.floor(path[i].x/size), startY=Math.floor(path[i].y/size);
    const endX=Math.floor(path[i+1].x/size), endY=Math.floor(path[i+1].y/size);
    for(let x=Math.max(0,Math.min(startX,endX));x<=Math.min(cols-1,Math.max(startX,endX));x++)
      if(terrain[startY]) terrain[startY][x]=2;
    for(let y=Math.max(0,Math.min(startY,endY));y<=Math.min(rows-1,Math.max(startY,endY));y++)
      if(terrain[y]?.[endX]!==undefined) terrain[y][endX]=2;
  }
  return terrain;
}
