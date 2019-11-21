<script>
  export let width;
  export let height;
  export let topPoint;
  export let style;
</script>

<path 
  d="
    M 0 {height}
    L {width} {height}
    L {width * topPoint} 0
    L 0 {height}
    Z
  "
  {style}
/>