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
// 이 화면은 항상 정리 모드라 길게 누를 필요가 없다. 다만 사진 위에서 화면을 스크롤할 수 있게,
// 터치는 잠깐(0.15초) 누른 채여야 드래그가 시작되고 그 전에 이만큼 넘게 움직이면 스크롤로 본다
const TOUCH_DELAY_MS = 150;
const TOUCH_TOLERANCE_PX = 5;
// 마우스는 이만큼 끌면 바로 시작 (클릭과 구분)
const MOUSE_DISTANCE_PX = 5;

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
 * 이 화면에 있는 동안은 항상 정리 모드(모든 사진이 흔들림)라 언제든 끌어서 옮긴다 (사용자 요청):
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
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: TOUCH_TOLERANCE_PX } }),
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 끄는 중: X·"사진 바꾸기"·사진 추가 버튼을 잠시 숨기거나 막는다 (흔들림은 늘 켜져 있음)
  const dragging = activeId !== null;
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
      <div className="compose-photos is-arranging">
        <div className="compose-section">
          <span className="compose-label">
            대표 사진 <span className="req">*</span>
          </span>
          <CoverSlot
            cover={cover}
            swapTarget={dragging && !coverIsActive}
            dragging={dragging}
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
                  dragging={dragging}
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
                  disabled={dragging}
                >
                  <PlusIcon size={20} strokeWidth={2} />
                </button>
              ))}
            </div>
          </SortableContext>
          {(extras.length > 0 || cover) && (
            <span className="hint">사진을 끌어서 순서를 바꾸거나 대표 사진과 바꿀 수 있어요.</span>
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
  dragging,
  onPick,
}: {
  cover: PhotoSlot | null;
  swapTarget: boolean;
  dragging: boolean;
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
        disabled={dragging}
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
      aria-label="대표 사진. 끌어서 다른 사진과 바꾸기"
    >
      <Wiggle index={0}>
        <img src={cover.preview} alt="대표 사진" decoding="async" />
        <SlotState slot={cover} />
      </Wiggle>
      {!dragging && (
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
  dragging,
  onRemove,
}: {
  slot: PhotoSlot;
  index: number;
  swapTarget: boolean;
  dragging: boolean;
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
      aria-label={`추가 사진 ${index + 1}. 끌어서 순서 바꾸기`}
    >
      <Wiggle index={index + 1}>
        <img src={slot.preview} alt={`추가 사진 ${index + 1}`} decoding="async" />
        <SlotState slot={slot} />
      </Wiggle>
      {!dragging && (
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

/** 흔들리는 안쪽 틀(정리 모드 표시). 칸 자체는 드래그 위치(transform)를 쓰므로 흔들림은 안쪽에 준다 */
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
