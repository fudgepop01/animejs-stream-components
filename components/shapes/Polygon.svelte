<script>
  export let width;
  // export let height;
  export let sides;
  export let curve;

  export let style;
  
  const calcComponents = () => {
    let radius = width / 2;
    let ratio = (180 * (sides - 2)) / sides;
    let startingAngle = 180 - ratio

    let innerAngle = 180 - ratio;
    let side = Math.sqrt( 2 * (radius ** 2) - 2 * radius ** 2 * Math.cos(innerAngle * Math.PI/180));

    return [side, startingAngle/2, innerAngle]
  }

  let path;
  let bezierPoints = [];
  $: {
    path = `M ${width / 2} 0`;
    bezierPoints = [];

    let x = width / 2;
    let y = 0;
    let dir = 0;

    // http://www.whizkidtech.redprince.net/bezier/circle/
    // https://stackoverflow.com/questions/1734745/how-to-create-circle-with-b%C3%A9zier-curves
    let KAPPA = 4/3 * Math.tan(Math.PI/(2 * sides));

    const KLength = KAPPA * (width / 2);
    const [sideLength, startingAngle, chDir] = calcComponents();

    const curvFormula = () => (chDir * curve)/2;

    for (let i = 0; i < sides; i++) {
      // 1st component set
      let xc1 = x + Math.cos(Math.PI/180 * (startingAngle + dir - curvFormula())) * KLength;
      let yc1 = y + Math.sin(Math.PI/180 * (startingAngle + dir - curvFormula())) * KLength;

      // destination x and y
      x += Math.cos(Math.PI/180 * (startingAngle + dir)) * sideLength;
      y += Math.sin(Math.PI/180 * (startingAngle + dir)) * sideLength;
      dir += chDir;

      // 2nd component set
      let xc2 = x - Math.cos(Math.PI/180 * (startingAngle + dir - chDir + curvFormula())) * KLength;
      let yc2 = y - Math.sin(Math.PI/180 * (startingAngle + dir - chDir + curvFormula())) * KLength;

      //path += `\nL ${x} ${y}`;
      path += `\nC${xc1} ${yc1}, ${xc2} ${yc2}, ${x} ${y}`
      bezierPoints.push([xc1, yc1], [xc2, yc2]);
    }
  }
</script>

<!-- debug tools -->
<!-- <circle cx="0" cy="0" r="5" {style}/> -->
<!-- <circle cx={width/2} cy={width/2} r={width/2} style="{style}; stroke-width: 0.5; stroke: #DDD;"/>
{#each bezierPoints as [xpos, ypos], i}
  <circle cx={xpos} cy={ypos} r="5" style="{style}; fill: {i % 2 === 0 ? 'red' : 'blue'};"/>
{/each} -->
<path 
  d={path}
  {style}
/>