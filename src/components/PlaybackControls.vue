<template>
  <div class="controls">
    <PrimaryButton
      class="playback"
      :class="{ playing: playbackActive }"
      :state="currentNodeId === currentNarrationNodeId ? 'highlighted' : ''"
      :icon="mediaBuffering ? 'buffering' : (playbackActive ? 'pause' : 'play')"
      :title="playbackActive ? 'Pause narration playback' : 'Resume narration playback'"
      @click="$emit('togglePlayback')"
    />
    <div ref="chapters" class="chapters" :class="{ shadow: !introPanelVisible, playing: playbackActive, open: chapterListVisible }">
      <div
        class="preview"
        :title="chapterListVisible ? 'Close narration log' : 'Open narration log'"
        @click="$emit('toggleChapterList')"
      >
        <span v-if="currentNarrationChapter">
          {{ currentNarrationChapter.label }}
        </span>
      </div>
      <ul ref="chapterList">
        <li
          v-for="(chapter, index) in narrationChapters"
          :key="index"
          :class="[
            chapter.type,
            revealedItems.indexOf(chapter.element) !== -1 ? 'revealed' : '',
            listenedChapterIndexes.indexOf(index) !== -1 ? 'listened' : '',
            currentNarrationChapterIndex === index ? 'active' : ''
          ]"
          @click="revealedItems.indexOf(chapter.element) !== -1 && $emit('jumpNarrationToChapter', index)"
        >
          <span>{{ chapter.label }}</span>
        </li>
      </ul>
    </div>
    <PrimaryButton
      class="jump"
      :class="{ visible: jumpActionVisible, shadow: !introPanelVisible }"
      :state="jumpActionAvailable ? 'highlighted' : 'disabled'"
      icon="jump"
      :title="jumpActionAvailable ? 'Resume narration from selected item' : 'Narration not available for selected item'"
      @click="$emit('jumpNarrationToNode', currentNodeId)"
    />
  </div>
</template>

<script>
import PrimaryButton from '@/components/PrimaryButton.vue';

export default {
  name: 'PlaybackControls',

  components: {
    PrimaryButton
  },

  props: {
    narrationChapters: Array,
    currentNodeId: String,
    currentNarrationNodeId: String,
    currentNarrationChapterIndex: Number,
    currentNarrationChapter: Object,
    listenedChapterIndexes: Array,
    revealedItems: Array,
    playbackActive: Boolean,
    mediaBuffering: Boolean,
    jumpActionVisible: Boolean,
    jumpActionAvailable: Boolean,
    chapterListVisible: Boolean,
    introPanelVisible: Boolean
  },

  emits: [
    'togglePlayback',
    'toggleChapterList',
    'jumpNarrationToChapter',
    'jumpNarrationToNode'
  ],

  watch: {
    // hacky way to keep the chapter list’s background blur active on Safari when controls are full-width
    playbackActive: function() {
      if (this.playbackActive === false && this.$refs.chapters.style['-webkit-backdrop-filter'] !== undefined) {
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

  > * {
    vertical-align: bottom;
    pointer-events: all;
  }

  *::selection {
    background: transparent;
  }

  button.playback {
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
        min-width: 326px;
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