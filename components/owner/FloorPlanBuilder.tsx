'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, Table as TableIcon, Plus, Trash2, Copy, Sliders, 
  X, Check, Move, Users, Square, Layers, Sparkles, ChevronRight, Eye, ListFilter
} from 'lucide-react';
import { useOwnerConfig, FloorTable } from '@/lib/ownerConfigContext';
import { cn } from '@/lib/utils';

export default function FloorPlanBuilder() {
  const { 
    floorTables, 
    selectedTableId, 
    setSelectedTableId, 
    addTable, 
    updateTable, 
    removeTable 
  } = useOwnerConfig();

  const [viewMode, setViewMode] = useState<'canvas' | 'table'>('canvas');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | 'Private' | 'Communal' | 'Bar'>('ALL');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // Dragging state on canvas
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialTableCoords, setInitialTableCoords] = useState<{ x: number; y: number } | null>(null);

  const selectedTable = floorTables.find(t => t.id === selectedTableId) || null;

  // Handle Drag Start
  const handlePointerDown = (e: React.PointerEvent, table: FloorTable) => {
    e.stopPropagation();
    setSelectedTableId(table.id);
    setDraggingTableId(table.id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialTableCoords({ x: table.x, y: table.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Handle Drag Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingTableId || !dragStartPos || !initialTableCoords || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    if (canvasRect.width === 0 || canvasRect.height === 0) return;

    const deltaPixelX = e.clientX - dragStartPos.x;
    const deltaPixelY = e.clientY - dragStartPos.y;

    const deltaPercentX = (deltaPixelX / canvasRect.width) * 100;
    const deltaPercentY = (deltaPixelY / canvasRect.height) * 100;

    let nextX = initialTableCoords.x + deltaPercentX;
    let nextY = initialTableCoords.y + deltaPercentY;

    // Boundary constraints
    const table = floorTables.find(t => t.id === draggingTableId);
    const w = table?.w || 12;
    const h = table?.h || 14;

    nextX = Math.max(1, Math.min(100 - w - 1, nextX));
    nextY = Math.max(1, Math.min(100 - h - 1, nextY));

    if (snapToGrid) {
      nextX = Math.round(nextX / 2) * 2;
      nextY = Math.round(nextY / 2) * 2;
    }

    updateTable(draggingTableId, {
      x: Math.round(nextX * 10) / 10,
      y: Math.round(nextY * 10) / 10
    });
  };

  // Handle Drag End
  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingTableId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setDraggingTableId(null);
      setDragStartPos(null);
      setInitialTableCoords(null);
    }
  };

  // Quick Duplicate table
  const handleDuplicate = (table: FloorTable) => {
    addTable({
      type: table.type,
      label: `${table.label} (Copy)`,
      capacity: table.capacity,
      table_category: table.table_category,
      x: Math.min(80, table.x + 4),
      y: Math.min(80, table.y + 4),
      w: table.w,
      h: table.h,
      adjacentTo: []
    });
  };

  // Total venue capacity stats
  const totalCapacity = floorTables.reduce((acc, t) => acc + t.capacity, 0);
  const boothCount = floorTables.filter(t => t.type === 'BOOTH').length;
  const tableCount = floorTables.filter(t => t.type === 'TABLE').length;
  const barCount = floorTables.filter(t => t.type === 'BAR').length;

  const filteredTables = activeCategoryFilter === 'ALL'
    ? floorTables
    : floorTables.filter(t => t.table_category === activeCategoryFilter);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header & Summary */}
      <div className="border-b border-[#DCE8E4] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#0F766E]/10 border border-[#0F766E]/30 flex items-center justify-center text-[#0F766E]">
              <LayoutGrid size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Interactive Floor Plan Builder</h2>
            <span className="text-[11px] font-sans uppercase bg-[#F3F8F7] text-[#0F766E] px-2.5 py-0.5 rounded border border-[#0F766E]/20 ml-2">
              Module 2
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Design the dining room matrix, table capacities, and physical seating coordinates that power live table assignments and Voice AI availability checks.
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Snap toggle */}
          <button
            type="button"
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-sans transition-colors flex items-center gap-1.5",
              snapToGrid 
                ? "bg-[#F3F8F7] border-[#0F766E]/50 text-[#0F766E]" 
                : "bg-[#FFFFFF] border-[#DCE8E4] text-slate-600 hover:text-slate-900"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>Snap Grid (2%)</span>
          </button>

          {/* Canvas vs Table toggle */}
          <div className="flex items-center bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5",
                viewMode === 'canvas' ? "bg-[#F3F8F7] text-slate-900 font-semibold" : "text-slate-600 hover:text-slate-800"
              )}
            >
              <LayoutGrid size={13} />
              <span>Canvas View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-sans transition-colors flex items-center gap-1.5",
                viewMode === 'table' ? "bg-[#F3F8F7] text-slate-900 font-semibold" : "text-slate-600 hover:text-slate-800"
              )}
            >
              <TableIcon size={13} />
              <span>Numerical View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg p-3">
          <span className="text-[11px] font-sans text-slate-600 uppercase">Total Seating Capacity</span>
          <div className="text-xl font-bold text-slate-900 font-sans mt-0.5 flex items-center gap-1.5">
            <Users size={16} className="text-[#0F766E]" />
            <span>{totalCapacity} Seats</span>
          </div>
        </div>
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg p-3">
          <span className="text-[11px] font-sans text-slate-600 uppercase">Private Booths</span>
          <div className="text-xl font-bold text-slate-900 font-sans mt-0.5">{boothCount}</div>
        </div>
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg p-3">
          <span className="text-[11px] font-sans text-slate-600 uppercase">Dining Tables</span>
          <div className="text-xl font-bold text-slate-900 font-sans mt-0.5">{tableCount}</div>
        </div>
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-lg p-3">
          <span className="text-[11px] font-sans text-slate-600 uppercase">Bar Stools</span>
          <div className="text-xl font-bold text-slate-900 font-sans mt-0.5">{barCount}</div>
        </div>
      </div>

      {/* Quick Add Toolbar */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans text-slate-600 uppercase mr-1">Quick Add:</span>
          
          <button
            type="button"
            onClick={() => addTable({ type: 'BOOTH', capacity: 6, table_category: 'Private', w: 16, h: 22 })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-900 rounded-lg text-xs font-sans transition-colors"
          >
            <Plus size={13} className="text-[#0F766E]" />
            <span>+ Booth (6-Cap)</span>
          </button>

          <button
            type="button"
            onClick={() => addTable({ type: 'TABLE', capacity: 4, table_category: 'Private', w: 13, h: 16 })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-900 rounded-lg text-xs font-sans transition-colors"
          >
            <Plus size={13} className="text-[#0F766E]" />
            <span>+ 4-Top Table</span>
          </button>

          <button
            type="button"
            onClick={() => addTable({ type: 'TABLE', capacity: 2, table_category: 'Private', w: 11, h: 14 })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-900 rounded-lg text-xs font-sans transition-colors"
          >
            <Plus size={13} className="text-[#0F766E]" />
            <span>+ 2-Top Table</span>
          </button>

          <button
            type="button"
            onClick={() => addTable({ type: 'BAR', capacity: 1, table_category: 'Bar', w: 9, h: 10 })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-900 rounded-lg text-xs font-sans transition-colors"
          >
            <Plus size={13} className="text-[#0F766E]" />
            <span>+ Bar Stool</span>
          </button>
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-1 bg-[#F3F8F7] border border-[#DCE8E4] p-1 rounded-lg">
          {(['ALL', 'Private', 'Communal', 'Bar'] as const).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategoryFilter(cat)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-sans rounded transition-colors",
                activeCategoryFilter === cat ? "bg-[#F3F8F7] text-[#0F766E] font-semibold" : "text-slate-600 hover:text-slate-800"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN VIEW: CANVAS vs NUMERICAL TABLE */}
      {viewMode === 'canvas' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Interactive Grid Canvas (3 Columns) */}
          <div className="lg:col-span-3">
            <div className="relative bg-[#F3F8F7] border border-[#DCE8E4] rounded-xl overflow-hidden shadow-2xl">
              {/* Floor Labels Overlay */}
              <div className="absolute top-3 left-4 text-[10px] font-sans text-slate-500 uppercase tracking-wider pointer-events-none flex items-center gap-4 z-10">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500/40" /> Booth Row (West)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500/40" /> Center Dining Room</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500/40" /> Craft Bar (East)</span>
              </div>

              {/* Graphical Canvas Surface */}
              <div
                ref={canvasRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={() => setSelectedTableId(null)}
                className="relative w-full h-[540px] select-none cursor-crosshair overflow-hidden touch-none"
                style={{
                  backgroundImage: `
                    radial-gradient(circle, #d9e7e1 1px, transparent 1px),
                    linear-gradient(to right, #e8f0ec 1px, transparent 1px),
                    linear-gradient(to bottom, #e8f0ec 1px, transparent 1px)
                  `,
                  backgroundSize: '24px 24px, 48px 48px, 48px 48px'
                }}
              >
                {/* Tables Rendered on Canvas */}
                {filteredTables.map((table) => {
                  const isSelected = selectedTableId === table.id;
                  const isDragging = draggingTableId === table.id;

                  return (
                    <div
                      key={table.id}
                      onPointerDown={(e) => handlePointerDown(e, table)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTableId(table.id);
                      }}
                      style={{
                        left: `${table.x}%`,
                        top: `${table.y}%`,
                        width: `${table.w}%`,
                        height: `${table.h}%`,
                        zIndex: isDragging ? 50 : isSelected ? 40 : 20
                      }}
                      className={cn(
                        "absolute rounded-lg border transition-shadow cursor-grab active:cursor-grabbing flex flex-col items-center justify-between p-1.5 text-center select-none shadow-md",
                        // Styling per table type
                        table.type === 'BOOTH' && "bg-[#FFFFFF] border-amber-500/40 shadow-amber-950/20",
                        table.type === 'TABLE' && "bg-[#F3F8F7] border-blue-500/40 shadow-blue-950/20",
                        table.type === 'BAR' && "bg-[#F3F8F7] border-purple-500/40 rounded-full shadow-purple-950/20",
                        // Selection styling
                        isSelected && "ring-2 ring-[#0F766E] border-[#0F766E] shadow-sm bg-[#F3F8F7]",
                        isDragging && "opacity-90 scale-[1.02] shadow-2xl"
                      )}
                    >
                      {/* Top Label */}
                      <div className="w-full flex items-center justify-between px-1">
                        <span className="text-[10px] font-sans font-bold text-slate-900 truncate">
                          {table.id}
                        </span>
                        <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-black/50 text-slate-700">
                          {table.capacity}p
                        </span>
                      </div>

                      {/* Middle visual icon/indicator */}
                      <div className="flex items-center justify-center my-auto text-slate-600">
                        {table.type === 'BOOTH' ? (
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-4 bg-amber-500/50 rounded-sm" />
                            <span className="text-[10px] font-sans text-slate-800">{table.capacity}</span>
                            <span className="w-1.5 h-4 bg-amber-500/50 rounded-sm" />
                          </div>
                        ) : table.type === 'BAR' ? (
                          <div className="w-4 h-4 rounded-full border border-purple-400 flex items-center justify-center text-[9px] text-purple-700 font-sans">
                            1
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/40" />
                          </div>
                        )}
                      </div>

                      {/* Bottom Micro Category */}
                      <div className="text-[8px] font-sans uppercase text-slate-600 tracking-tight truncate w-full">
                        {table.table_category}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="p-2.5 bg-[#FFFFFF] border-t border-[#DCE8E4] flex items-center justify-between text-[11px] text-slate-600 font-sans">
                <span className="flex items-center gap-1.5">
                  <Move size={12} className="text-[#0F766E]" />
                  Click and drag tables directly on the grid to position dining zones.
                </span>
                <span>Coordinates synced live with floor_graph.json</span>
              </div>
            </div>
          </div>

          {/* TABLE CONFIGURATION SIDE-PANEL (1 Column) */}
          <div className="lg:col-span-1">
            <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-5 space-y-4 sticky top-4">
              <div className="flex items-center justify-between border-b border-[#DCE8E4] pb-3">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-[#0F766E]" />
                  <h3 className="text-sm font-semibold text-slate-900">Table Configuration</h3>
                </div>
                {selectedTable && (
                  <span className="text-xs font-sans font-bold text-[#0F766E] bg-[#F3F8F7] px-2 py-0.5 rounded border border-[#0F766E]/30">
                    {selectedTable.id}
                  </span>
                )}
              </div>

              {selectedTable ? (
                <div className="space-y-4">
                  {/* Table ID */}
                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Table ID / Identifier
                    </label>
                    <input
                      type="text"
                      value={selectedTable.id}
                      onChange={(e) => updateTable(selectedTable.id, { id: e.target.value })}
                      className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3 py-1.5 text-xs text-slate-900 font-sans focus:outline-none"
                    />
                  </div>

                  {/* Table Label */}
                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Display Label
                    </label>
                    <input
                      type="text"
                      value={selectedTable.label}
                      onChange={(e) => updateTable(selectedTable.id, { label: e.target.value })}
                      className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3 py-1.5 text-xs text-slate-900 font-sans focus:outline-none"
                    />
                  </div>

                  {/* Capacity Stepper */}
                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Seating Capacity
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateTable(selectedTable.id, { capacity: Math.max(1, selectedTable.capacity - 1) })}
                        className="w-8 h-8 rounded-lg bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-900 flex items-center justify-center text-sm font-sans"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={selectedTable.capacity}
                        onChange={(e) => updateTable(selectedTable.id, { capacity: parseInt(e.target.value, 10) || 1 })}
                        className="w-full text-center bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg py-1.5 text-sm text-slate-900 font-sans font-bold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateTable(selectedTable.id, { capacity: selectedTable.capacity + 1 })}
                        className="w-8 h-8 rounded-lg bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-900 flex items-center justify-center text-sm font-sans"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Seating Type Selector */}
                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Physical Format
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#F3F8F7] border border-[#DCE8E4] p-1 rounded-lg">
                      {(['BOOTH', 'TABLE', 'BAR'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => updateTable(selectedTable.id, { type })}
                          className={cn(
                            "py-1 text-[10px] font-sans rounded transition-colors",
                            selectedTable.type === type ? "bg-[#F3F8F7] text-[#0F766E] font-semibold" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table Category */}
                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Availability Category
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#F3F8F7] border border-[#DCE8E4] p-1 rounded-lg">
                      {(['Private', 'Communal', 'Bar'] as const).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => updateTable(selectedTable.id, { table_category: cat })}
                          className={cn(
                            "py-1 text-[10px] font-sans rounded transition-colors",
                            selectedTable.table_category === cat ? "bg-[#F3F8F7] text-[#0F766E] font-semibold" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Under the Packed House Rule, AI pivots to Communal or Bar when Private is full.
                    </p>
                  </div>

                  {/* Position Micro-adjusters (X, Y, W, H) */}
                  <div className="pt-2 border-t border-[#DCE8E4] space-y-2">
                    <span className="text-[10px] font-sans text-slate-500 uppercase block">Spatial Coordinates (%)</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                      <div className="flex items-center justify-between bg-[#F3F8F7] px-2 py-1 rounded border border-[#DCE8E4]">
                        <span className="text-slate-500">X:</span>
                        <span className="text-slate-900">{selectedTable.x}%</span>
                      </div>
                      <div className="flex items-center justify-between bg-[#F3F8F7] px-2 py-1 rounded border border-[#DCE8E4]">
                        <span className="text-slate-500">Y:</span>
                        <span className="text-slate-900">{selectedTable.y}%</span>
                      </div>
                      <div className="flex items-center justify-between bg-[#F3F8F7] px-2 py-1 rounded border border-[#DCE8E4]">
                        <span className="text-slate-500">W:</span>
                        <span className="text-slate-900">{selectedTable.w}%</span>
                      </div>
                      <div className="flex items-center justify-between bg-[#F3F8F7] px-2 py-1 rounded border border-[#DCE8E4]">
                        <span className="text-slate-500">H:</span>
                        <span className="text-slate-900">{selectedTable.h}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Duplicate & Remove */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(selectedTable)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg text-xs font-sans text-slate-800 transition-colors"
                    >
                      <Copy size={12} />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTable(selectedTable.id)}
                      className="p-1.5 bg-red-100/30 hover:bg-red-100/60 border border-red-800/40 text-red-700 rounded-lg transition-colors"
                      title="Delete Table"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 space-y-2">
                  <LayoutGrid size={24} className="mx-auto opacity-30 text-slate-600" />
                  <p className="text-xs">Click any table on the canvas to configure capacity, type, and coordinates.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* NUMERICAL DATA TABLE VIEW */
        <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#DCE8E4] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Floor Plan Data Matrix</h3>
            <span className="text-xs font-sans text-slate-600">{floorTables.length} Active Seating Units</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F3F8F7] text-slate-600 uppercase text-[10px] border-b border-[#DCE8E4]">
                <tr>
                  <th className="px-4 py-3">Table ID</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Capacity</th>
                  <th className="px-4 py-3 text-center">X (%)</th>
                  <th className="px-4 py-3 text-center">Y (%)</th>
                  <th className="px-4 py-3 text-center">Width</th>
                  <th className="px-4 py-3 text-center">Height</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8E4] text-slate-800">
                {floorTables.map((table) => (
                  <tr key={table.id} className="hover:bg-[#F3F8F7] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-[#0F766E]">{table.id}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={table.label}
                        onChange={(e) => updateTable(table.id, { label: e.target.value })}
                        className="bg-transparent border border-transparent hover:border-[#DCE8E4] focus:border-[#0F766E] px-1.5 py-0.5 rounded text-slate-900 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={table.type}
                        onChange={(e) => updateTable(table.id, { type: e.target.value as any })}
                        className="bg-[#F3F8F7] border border-[#DCE8E4] rounded px-2 py-0.5 text-slate-800 focus:outline-none"
                      >
                        <option value="BOOTH">BOOTH</option>
                        <option value="TABLE">TABLE</option>
                        <option value="BAR">BAR</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={table.table_category}
                        onChange={(e) => updateTable(table.id, { table_category: e.target.value as any })}
                        className="bg-[#F3F8F7] border border-[#DCE8E4] rounded px-2 py-0.5 text-slate-800 focus:outline-none"
                      >
                        <option value="Private">Private</option>
                        <option value="Communal">Communal</option>
                        <option value="Bar">Bar</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={table.capacity}
                        onChange={(e) => updateTable(table.id, { capacity: parseInt(e.target.value, 10) || 1 })}
                        className="w-14 text-center bg-[#F3F8F7] border border-[#DCE8E4] rounded px-1 py-0.5 text-slate-900 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="number"
                        value={table.x}
                        onChange={(e) => updateTable(table.id, { x: parseFloat(e.target.value) || 0 })}
                        className="w-14 text-center bg-[#F3F8F7] border border-[#DCE8E4] rounded px-1 py-0.5 text-slate-700 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="number"
                        value={table.y}
                        onChange={(e) => updateTable(table.id, { y: parseFloat(e.target.value) || 0 })}
                        className="w-14 text-center bg-[#F3F8F7] border border-[#DCE8E4] rounded px-1 py-0.5 text-slate-700 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center">{table.w}%</td>
                    <td className="px-4 py-2.5 text-center">{table.h}%</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeTable(table.id)}
                        className="text-slate-500 hover:text-red-700 p-1 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
