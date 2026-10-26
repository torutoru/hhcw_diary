import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type ReactNode } from 'react';
import { CloseIcon, PhotoIcon, PlusIcon } from './Icons';

export interface PhotoSlot {
  key: string;
  preview: string;
  imageId?: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  /** 이 화면에서 새로 올린 사진. 빼면 서버에서 바로 지운다 (저장된 피드의 기존 사진은 저장할 때 정리) */
  fresh?: boolean;
}

export const MAX_EXTRA = 5;
const COVER_ID = 'cover';
// 길게 누르기 0.5초 뒤 드래그 시작. 그 전에 손가락이 이만큼 넘게 움직이면 화면 스크롤로 본다
const PRESS_DELAY_MS = 500;
const PRESS_TOLERANCE_PX = 8;

interface Props {
  cover: PhotoSlot | null;
  extras: PhotoSlot[];
  onExtrasChange: (extras: PhotoSlot[]) => void;
  /** 추가 사진과 대표 사진 맞바꾸기 (대표 사진이 없으면 그 사진이 대표가 된다) */
  onSwapCover: (key: string) => void;
  onRemoveExtra: (slot: PhotoSlot) => void;
  onPickCover: () => void;
  onAddExtra: () => void;
}

/**
 * 피드 작성·수정의 대표 사진 + 사진 더하기.
 * 사진을 길게 누르면 정리 모드(모든 사진이 흔들림)로 들어가 끌어서 옮긴다:
 * - 사진 더하기 안에서: 끼워 넣기 (사이 사진들이 실시간으로 한 칸씩 밀려남)
 * - 대표 사진 ↔ 사진 더하기: 두 사진만 맞바꾸기
 */
export default function ComposePhotos({
  cover,
  extras,
  onExtrasChange,
  onSwapCover,
  onRemoveExtra,
  onPickCover,
  onAddExtra,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: PRESS_DELAY_MS, tolerance: PRESS_TOLERANCE_PX } }),
    useSensor(MouseSensor, { activationConstraint: { delay: PRESS_DELAY_MS, tolerance: PRESS_TOLERANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const arranging = activeId !== null;
  const activeSlot = activeId === COVER_ID ? cover : (extras.find((s) => s.key === activeId) ?? null);
  const coverIsActive = activeId === COVER_ID;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    navigator.vibrate?.(10);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const from = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    if (!to || from === to) return;
    if (from === COVER_ID) return onSwapCover(to); // 대표 사진을 추가 사진 위에 → 맞바꾸기
    if (to === COVER_ID) return onSwapCover(from); // 추가 사진을 대표 사진 위에 → 맞바꾸기
    const oldIndex = extras.findIndex((s) => s.key === from);
    const newIndex = extras.findIndex((s) => s.key === to);
    if (oldIndex >= 0 && newIndex >= 0) onExtrasChange(arrayMove(extras, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className={`compose-photos${arranging ? ' is-arranging' : ''}`}>
        <div className="compose-section">
          <span className="compose-label">
            대표 사진 <span className="req">*</span>
          </span>
          <CoverSlot
            cover={cover}
            swapTarget={arranging && !coverIsActive}
            arranging={arranging}
            onPick={onPickCover}
          />
        </div>

        <div className="compose-section">
          <div className="compose-label-row">
            <span className="compose-label">사진 더하기</span>
            <span className="hint">
              {extras.length} / {MAX_EXTRA}
            </span>
          </div>
          <SortableContext items={extras.map((s) => s.key)} strategy={rectSortingStrategy}>
            <div className="thumbs">
              {extras.map((s, i) => (
                <ExtraSlot
                  key={s.key}
                  slot={s}
                  index={i}
                  swapTarget={coverIsActive}
                  arranging={arranging}
                  onRemove={() => onRemoveExtra(s)}
                />
              ))}
              {Array.from({ length: MAX_EXTRA - extras.length }, (_, i) => (
                <button
                  key={`empty-${i}`}
                  type="button"
                  className="thumb-add"
                  aria-label="사진 추가"
                  onClick={onAddExtra}
                  disabled={arranging}
                >
                  <PlusIcon size={20} strokeWidth={2} />
                </button>
              ))}
            </div>
          </SortableContext>
          {(extras.length > 0 || cover) && (
            <span className="hint">사진을 길게 누른 채 끌면 순서를 바꾸거나 대표 사진과 바꿀 수 있어요.</span>
          )}
        </div>
      </div>

      {/* 끌고 있는 사진은 손가락을 따라 떠서 움직이고, 원래 자리는 흐리게 남는다 */}
      <DragOverlay>
        {activeSlot && (
          <div className={`photo-lifted${coverIsActive ? ' is-cover' : ''}`}>
            <img src={activeSlot.preview} alt="" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// 손가락 아래의 칸을 먼저 고르고(큰 대표 사진 칸도 정확히), 칸 사이 빈틈이면 가장 가까운 칸
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

function CoverSlot({
  cover,
  swapTarget,
  arranging,
  onPick,
}: {
  cover: PhotoSlot | null;
  swapTarget: boolean;
  arranging: boolean;
  onPick: () => void;
}) {
  const drop = useDroppable({ id: COVER_ID });
  const drag = useDraggable({ id: COVER_ID, disabled: !cover });
  const highlight = swapTarget && drop.isOver;

  if (!cover) {
    // 대표 사진이 없을 때도 추가 사진을 끌어다 놓으면 대표가 된다
    return (
      <button
        ref={drop.setNodeRef}
        type="button"
        className={`cover-pick${highlight ? ' is-swap-target' : ''}`}
        onClick={onPick}
        disabled={arranging}
      >
        <PhotoIcon size={36} strokeWidth={1.6} />
        대표 사진 고르기
      </button>
    );
  }

  return (
    <div
      ref={(node) => {
        drop.setNodeRef(node);
        drag.setNodeRef(node);
      }}
      className={`cover-preview${drag.isDragging ? ' is-placeholder' : ''}${highlight ? ' is-swap-target' : ''}`}
      {...drag.attributes}
      {...drag.listeners}
      aria-label="대표 사진. 길게 누른 채 끌어서 다른 사진과 바꾸기"
    >
      <Wiggle index={0}>
        <img src={cover.preview} alt="대표 사진" decoding="async" />
        <SlotState slot={cover} />
      </Wiggle>
      {!arranging && (
        <button type="button" className="chip-btn" onClick={onPick} {...stopDrag}>
          사진 바꾸기
        </button>
      )}
    </div>
  );
}

function ExtraSlot({
  slot,
  index,
  swapTarget,
  arranging,
  onRemove,
}: {
  slot: PhotoSlot;
  index: number;
  swapTarget: boolean;
  arranging: boolean;
  onRemove: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging, isOver } = useSortable({
    id: slot.key,
  });
  return (
    <div
      ref={setNodeRef}
      className={`thumb${isDragging ? ' is-placeholder' : ''}${swapTarget && isOver ? ' is-swap-target' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={`추가 사진 ${index + 1}. 길게 누른 채 끌어서 순서 바꾸기`}
    >
      <Wiggle index={index + 1}>
        <img src={slot.preview} alt={`추가 사진 ${index + 1}`} decoding="async" />
        <SlotState slot={slot} />
      </Wiggle>
      {!arranging && (
        <button type="button" className="thumb-remove" aria-label="사진 빼기" onClick={onRemove} {...stopDrag}>
          <CloseIcon size={12} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

// 칸 안의 버튼(X, 사진 바꾸기)을 꾹 눌러도 사진 드래그가 시작되지 않게
const stopDrag = {
  onTouchStart: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onMouseDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
};

/** 정리 모드에서 흔들리는 안쪽 틀. 칸 자체는 드래그 위치(transform)를 쓰므로 흔들림은 안쪽에 준다 */
function Wiggle({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="photo-wiggle" style={{ animationDelay: `${(index % 3) * -0.12}s` }}>
      {children}
    </div>
  );
}

export function SlotState({ slot }: { slot: PhotoSlot }) {
  if (slot.status === 'uploading') return <span className="upload-state">올리는 중</span>;
  if (slot.status === 'error')
    return (
      <span className="upload-state is-error" title={slot.error}>
        실패
      </span>
    );
  return null;
}
