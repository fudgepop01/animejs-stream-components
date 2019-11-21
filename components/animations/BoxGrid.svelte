<script context="module">
  import anime from "animejs";
  const { stagger } = anime;

  export const animation = (rows = 20, columns = 10) => {
    return {
      targets: document.getElementsByClassName("boxgrid-anim"),
      easing: "easeInOutExpo",
      keyframes: [
        {
          duration: 2000,
          opacity: 0.05,
          fill: "#ff0000",
          scale: 5
        },
        {
          duration: 1000,
          fill: "#ffffff"
        },
        {
          duration: 2000,
          opacity: 1,
          scale: 1,
          fill: "#80bfff"
        }
      ],
      delay: stagger(100, { grid: [columns, rows], from: "center" })
    };
  };

  export const props = {
    rows: 20,
    columns: 10,
    boxSize: 20,
    x: 0,
    y: 0,
    boxColor: "#80bfff"
  };
</script>

<script>
  export let rows = props.rows;
  export let columns = props.columns;
  export let boxSize = props.boxSize;
  export let x = props.x;
  export let y = props.y;
  export let boxColor = props.boxColor;
</script>

<svg 
  x="{x}"
  y="{y}"
  width="{rows * (boxSize + 1)}" 
  height="{columns * (boxSize + 1)}"
>
  {#each new Array(parseInt(rows)).fill(0) as _, i}
    {#each new Array(parseInt(columns)).fill(0) as _, j}
      <rect 
        class="boxgrid-anim"
        x="{(boxSize + 1) * i}" 
        y="{(boxSize + 1) * j}" 
        width="{boxSize}" 
        height="{boxSize}"
        style="
          transform-origin: 
            {(boxSize + 1) * i + (boxSize + 1)/2}px 
            {(boxSize + 1) * j + (boxSize + 1)/2}px;
          transform: scale(1);
        "
        fill="{boxColor}"
      />
    {/each}
  {/each}
</svg>