<template>
  <div>
    <PrimaryButton
      :state="state"
      :icon="icon"
    />
    <svg width="64" height="64">
      <circle
        r="30.5"
        cx="32"
        cy="32"
        stroke-width="3"
        :stroke-dasharray="circumference + ' ' +  circumference"
        :stroke-dashoffset="offset"
      />
    </svg>
  </div>
</template>

<script>
import PrimaryButton from '@/components/PrimaryButton.vue';

export default {
  name: 'PlayButton',

  components: {
    PrimaryButton
  },

  props: {
    state: {
      type: String,
      default: ''
    },
    icon: {
      type: String,
      default: ''
    },
    progress: {
      type: Number,
      default: 0
    }
  },

  data() {
    return {
      circumference: 30.5 * 2 * Math.PI
    }
  },

  computed: {
    offset() {
      return this.circumference - this.progress * this.circumference;
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/variables.css';

div {
  pointer-events: none;
  transition: transform var(--transition-duration) var(--transition-timing);

  &:hover {
    transform: scale(1.0625);
  }
}

button {
  display: block;
  pointer-events: all;

  &:hover {
    transform: none;
  }
}

svg {
  position: absolute;
  bottom: 0;
  transform: rotate(-90deg);

  circle {
    fill: transparent;
    stroke: #fff;
    transition: stroke-dashoffset var(--transition-duration) var(--transition-timing);
  }
}
</style>