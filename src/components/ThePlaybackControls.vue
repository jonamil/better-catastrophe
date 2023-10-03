<template>
  <div class="controls">
    <ThePlayButton
      class="playback"
      :class="{ playing: flowchartStore.playbackActive }"
      :state="flowchartStore.currentNodeId === flowchartStore.currentNarrationNodeId ? 'highlighted' : ''"
      :progress="flowchartStore.playbackProgress"
      :icon="playButtonIcon"
      :title="playButtonTitle"
      @click="$emit(flowchartStore.exploringDuringPlayback ? 'stopExplorationDuringPlayback' : 'togglePlayback')"
    />
    <div ref="chapters" class="chapters" :class="{ shadow: !introPanelVisible, playing: flowchartStore.playbackActive, open: chapterListVisible }">
      <div
        class="preview"
        :title="chapterListVisible ? 'Close narration log' : 'Open narration log'"
        @click="$emit('toggleChapterList')"
      >
        <span v-if="flowchartStore.currentNarrationChapter">
          {{ flowchartStore.currentNarrationChapter.label }}
        </span>
      </div>
      <ul ref="chapterList">
        <li
          v-for="(chapter, index) in flowchartStore.narrationChapters"
          :key="index"
          :class="[
            chapter.type,
            flowchartStore.revealedItems.indexOf(chapter.element.id) !== -1 ? 'revealed' : '',
            flowchartStore.listenedChapterIndexes.indexOf(index) !== -1 ? 'listened' : '',
            flowchartStore.currentNarrationChapterIndex === index ? 'active' : ''
          ]"
          @click="flowchartStore.revealedItems.indexOf(chapter.element.id) !== -1 && $emit('jumpNarrationToChapter', index)"
        >
          <span>{{ chapter.label }}</span>
        </li>
      </ul>
    </div>
    <PrimaryButton
      class="jump"
      :class="{ visible: flowchartStore.jumpActionVisible, shadow: !introPanelVisible }"
      :state="flowchartStore.jumpActionAvailable ? 'highlighted' : 'disabled'"
      icon="jump"
      :title="flowchartStore.jumpActionAvailable ? 'Resume narration from selected item' : 'Narration not available for selected item'"
      :tabindex="!flowchartStore.jumpActionAvailable ? -1 : ''"
      @click="$emit('jumpNarrationToNode', flowchartStore.currentNodeId)"
    />
  </div>
</template>

<script>
import { mapStores } from 'pinia';

import ThePlayButton from '@/components/ThePlayButton.vue';
import PrimaryButton from '@/components/PrimaryButton.vue';

import { useFlowchartStore } from '@/stores/FlowchartStore.js';

export default {
  name: 'ThePlaybackControls',

  components: {
    ThePlayButton,
    PrimaryButton
  },

  props: {
    chapterListVisible: Boolean,
    introPanelVisible: Boolean
  },

  emits: [
    'stopExplorationDuringPlayback',
    'togglePlayback',
    'toggleChapterList',
    'jumpNarrationToChapter',
    'jumpNarrationToNode'
  ],

  computed: {
    ...mapStores(useFlowchartStore),
    playButtonIcon() {
      if (this.flowchartStore.mediaBuffering) {
        return 'buffering';
      } else if (!this.flowchartStore.playbackActive) {
        return 'play';
      } else if (this.flowchartStore.exploringDuringPlayback) {
        return 'return';
      } else {
        return 'pause';
      }
    },
    playButtonTitle() {
      if (this.flowchartStore.mediaBuffering) {
        return 'Narration audio loading…';
      } else if (!this.flowchartStore.playbackActive) {
        return 'Resume narration playback';
      } else if (this.flowchartStore.exploringDuringPlayback) {
        return 'Return to playback location';
      } else {
        return 'Pause narration playback';
      }
    }
  },

  watch: {
    // hacky way to keep the chapter list’s background blur active on Safari when controls are full-width
    playbackActive: function() {
      if (this.flowchartStore.playbackActive === false && this.$refs.chapters.style['-webkit-backdrop-filter'] !== undefined) {
        this.$refs.chapters.style['-webkit-backdrop-filter'] = `blur(${ 16 + Math.random() / 100 }px)`;
      }
    },
    chapterListVisible: function() {
      if (this.chapterListVisible) {
        this.$refs.chapterList.querySelector('li.active').scrollIntoView({
          behavior: 'instant',
          block: 'center'
        });
      }
    }
  }
}
</script>

<style lang="scss">
@import '@/assets/variables.css';

.controls {
  position: absolute;
  z-index: 101;
  bottom: 16px;
  left: 16px;
  right: 16px;
  width: 460px;
  line-height: 20px;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;

  > * {
    vertical-align: bottom;
    pointer-events: all;
  }

  .playback {
    position: absolute;
    z-index: 1;
    bottom: 0;
  }

  .chapters {
    position: relative;
    display: inline-block;
    overflow: hidden;
    width: 384px;
    height: 64px;
    border-radius: 32px;
    background: rgba(90,90,90,0.75);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-shadow: 0 0 0 0 var(--background-color);
    transition-property: width, height, box-shadow;
    transition-duration: var(--transition-duration), var(--transition-duration), var(--transition-duration-long);
    transition-timing-function: var(--transition-timing);

    &.shadow {
      box-shadow: 0 0 0 2px var(--background-color);
    }

    &.playing {
      width: 64px;
    }

    &:not(.playing).open {
      height: 336px;

      .preview {
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);

        &:after {
          transform: rotate(0deg);
        }
      }
    }

    .preview {
      position: absolute;
      display: flex;
      align-items: center;
      bottom: 0;
      left: 32px;
      width: 304px;
      height: 64px;
      padding-left: 48px;
      box-shadow: inset 0 1px 0 transparent;
      transition: background-color var(--transition-duration) var(--transition-timing), box-shadow var(--transition-duration) var(--transition-timing);
      cursor: pointer;
      
      &:hover {
        background-color: rgba(255,255,255,0.05);
      }
      
      &:after {
        position: absolute;
        display: block;
        content: '';
        top: 24px;
        right: 22px;
        width: 16px;
        height: 16px;
        background-image: url('@/assets/icons/chevron.svg');
        transform: rotate(-180deg);
        transition: transform var(--transition-duration) var(--transition-timing);
      }

      span {
        width: 100%;
        margin-right: 24px;
        padding-bottom: 1px;
      }
    }

    ul {
      position: absolute;
      overflow-y: auto;
      bottom: 64px;
      width: 384px;
      height: 272px;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        padding: 6.5px 0 7.5px 80px;
        font-weight: 600;
        background-size: 8px;
        background-position: center left 28px;
        background-repeat: no-repeat;
        cursor: default;

        &.revealed {
          cursor: pointer;
        }

        &.revealed:hover:not(.active) {
          background-color: rgba(255,255,255,0.125);
        }

        &:not(.revealed) span {
          color: transparent;
          background: rgba(0,0,0,0.4);
        }

        &.revealed:not(.listened):not(.active) {
          background-image: url('@/assets/icons/new.svg');
        }

        &.listened {
          font-weight: normal;
        }

        &.active {
          font-weight: normal;
          color: #fff;
          background-size: 18px;
          background-position: center left 23px;
          background-image: url('@/assets/icons/playing.svg');
          background-color: rgba(255,255,255,0.25);
        }

        &.primary {
          position: relative;
          margin-top: 24px;

          &:not(:first-child):before {
            position: absolute;
            display: block;
            content: '';
            top: -12px;
            left: 0;
            right: 0;
            height: 1px;
            background: rgba(255,255,255,0.15);
          }
        }

        &:first-child {
          margin-top: 24px;
        }

        &:last-child {
          margin-bottom: 24px;
        }

        span {
          display: inline-block;
        }
      }
    }
  }

  button.jump {
    visibility: hidden;
    opacity: 0;
    margin-left: 12px;
    box-shadow: 0 0 0 0px var(--background-color);

    &.visible {
      visibility: visible;
      opacity: 1;
    }

    &.shadow {
      box-shadow: 0 0 0 2px var(--background-color);
    }
  }
}

@media (max-width: 600px) {
  .controls {
    display: flex;
    align-items: flex-end;
    width: unset;

    .chapters {
      flex: 1;
      width: unset;

      &.playing {
        flex: 0;
        width: 64px;
      }

      .preview {
        box-sizing: border-box;
        width: calc(100% - 32px);

        span {
          -webkit-mask-image: linear-gradient(to right, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 90%);
          mask-image: linear-gradient(to right, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 90%);
        }
      }

      ul {
        width: 100%;
        min-width: 384px;
      }
    }

    button.jump {
      display: none;
      flex: 0 0 64px;

      &.visible {
        display: block;
      }
    }
  }
}
</style>