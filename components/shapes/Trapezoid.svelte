<script>
  export let width;
  export let height;
  export let leftPoint;
  export let rightPoint;
  export let style;
</script>

<path 
  d="
    M 0 {height}
    L {width * leftPoint} 0
    L {width * rightPoint} 0
    L {width} {height}
    L 0 {height}
    Z
  "
  {style}
/>