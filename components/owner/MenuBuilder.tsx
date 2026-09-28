'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UtensilsCrossed, Plus, Upload, Search, Edit2, Trash2, 
  Check, X, AlertTriangle, Sparkles, Clock, Flame, Tag, DollarSign,
  FileSpreadsheet, Filter, CheckCircle2, ChevronRight
} from 'lucide-react';
import { useOwnerConfig, OwnerMenuItem } from '@/lib/ownerConfigContext';
import { cn } from '@/lib/utils';

const STATION_OPTIONS: Array<OwnerMenuItem['station']> = [
  'Noodle Line',
  'Pizza Oven',
  'Grill',
  'Fryer',
  'Bar'
];

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Pescatarian',
  'Halal',
  'Nut-Free'
];

const SAMPLE_BULK_IMPORT: OwnerMenuItem[] = [
  {
    item_id: "LP_IMPORT_PORK_BELLY_BAO",
    venue: "leed pizza Main St",
    item_name: "Pork Belly Bao Buns (2pc)",
    description: "Slow-braised pork belly, pickled cucumber, crushed peanuts, hoisin glaze, steamed bao",
    price: 15.50,
    station: "Grill",
    cook_time_minutes: 7,
    dietary_tags: ["Dairy-Free"],
    ai_description: "Steamy Taiwanese street bao filled with melt-in-your-mouth pork belly and sweet hoisin."
  },
  {
    item_id: "LP_IMPORT_TRUFFLE_FRIES",
    venue: "leed pizza Main St",
    item_name: "Truffle Parm Fries",
    description: "Hand-cut fries, white truffle oil, grated grana padano, rosemary, garlic aioli",
    price: 13.00,
    station: "Fryer",
    cook_time_minutes: 5,
    dietary_tags: ["Vegetarian", "Gluten-Free"],
    ai_description: "Crispy skin-on fries drizzled with aromatic white truffle oil and fresh shaved parmesan."
  },
  {
    item_id: "LP_IMPORT_HAZY_IPA",
    venue: "leed pizza Main St",
    item_name: "Superflux Colour & Shape IPA",
    description: "Local East Van hazy IPA on tap, tropical citrus notes, smooth oat body (6.5% ABV)",
    price: 9.75,
    station: "Bar",
    cook_time_minutes: 1,
    dietary_tags: ["Vegetarian", "Vegan"],
    ai_description: "Our signature tap IPA bursting with juicy tropical hops and silky smooth texture."
  }
];

export default function MenuBuilder() {
  const { 
    menuItems, 
    addMenuItem, 
    updateMenuItem, 
    removeMenuItem, 
    toggle86, 
    bulkImportMenuItems 
  } = useOwnerConfig();

  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [editingItem, setEditingItem] = useState<OwnerMenuItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkJsonText, setBulkJsonText] = useState(JSON.stringify(SAMPLE_BULK_IMPORT, null, 2));

  // Form state for Create / Edit
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState<number>(18.00);
  const [formStation, setFormStation] = useState<OwnerMenuItem['station']>('Noodle Line');
  const [formCookTime, setFormCookTime] = useState<number>(6);
  const [formDietaryTags, setFormDietaryTags] = useState<string[]>([]);
  const [formAiDescription, setFormAiDescription] = useState('');

  // Open Edit Modal
  const openEditModal = (item: OwnerMenuItem) => {
    setEditingItem(item);
    setFormName(item.item_name);
    setFormDescription(item.description);
    setFormPrice(item.price);
    setFormStation(item.station);
    setFormCookTime(item.cook_time_minutes);
    setFormDietaryTags(item.dietary_tags || []);
    setFormAiDescription(item.ai_description || '');
    setIsCreating(false);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormDescription('');
    setFormPrice(18.00);
    setFormStation('Noodle Line');
    setFormCookTime(6);
    setFormDietaryTags([]);
    setFormAiDescription('');
    setIsCreating(true);
  };

  // Save Modal Form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (isCreating) {
      addMenuItem({
        item_name: formName.trim(),
        description: formDescription.trim(),
        price: Number(formPrice) || 0,
        station: formStation,
        cook_time_minutes: Number(formCookTime) || 5,
        dietary_tags: formDietaryTags,
        ai_description: formAiDescription.trim()
      });
      setIsCreating(false);
    } else if (editingItem) {
      updateMenuItem(editingItem.item_id, {
        item_name: formName.trim(),
        description: formDescription.trim(),
        price: Number(formPrice) || 0,
        station: formStation,
        cook_time_minutes: Number(formCookTime) || 5,
        dietary_tags: formDietaryTags,
        ai_description: formAiDescription.trim()
      });
      setEditingItem(null);
    }
  };

  // Bulk Import Submit
  const handleBulkImportSubmit = () => {
    try {
      const parsed = JSON.parse(bulkJsonText);
      if (Array.isArray(parsed)) {
        bulkImportMenuItems(parsed);
        setIsBulkImportOpen(false);
      }
    } catch (err) {
      alert('Invalid JSON format. Please ensure valid JSON array.');
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesStation = selectedStation === 'ALL' || item.station === selectedStation;
      const matchesSearch = searchQuery === '' || 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStation && matchesSearch;
    });
  }, [menuItems, selectedStation, searchQuery]);

  // Inventory stats
  const activeCount = menuItems.filter(i => !i.is_86).length;
  const count86 = menuItems.filter(i => i.is_86).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="border-b border-[#DCE8E4] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#0F766E]/10 border border-[#0F766E]/30 flex items-center justify-center text-[#0F766E]">
              <UtensilsCrossed size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Menu Matrix &amp; Kitchen Routing</h2>
            <span className="text-[11px] font-sans uppercase bg-[#F3F8F7] text-[#0F766E] px-2.5 py-0.5 rounded border border-[#0F766E]/20 ml-2">
              CRUD Module 3
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Manage recipes, ticket cook times, station routing, and live 86 status. Updates synchronize with the AI Voice inventory and KDS line displays.
          </p>
        </div>

        {/* Top Actions: Add New Item & Bulk Import */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-800 rounded-lg text-xs font-sans transition-colors"
          >
            <Upload size={13} className="text-[#0F766E]" />
            <span>Bulk Import</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0F766E] hover:bg-[#0F766E] text-white font-semibold rounded-lg text-xs font-sans transition-colors shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items or ingredients..."
            className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-zinc-500 focus:outline-none font-sans"
          />
        </div>

        {/* Station Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-0.5 bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg">
          {['ALL', ...STATION_OPTIONS].map(station => (
            <button
              key={station}
              type="button"
              onClick={() => setSelectedStation(station)}
              className={cn(
                "px-2.5 py-1 text-xs font-sans rounded whitespace-nowrap transition-colors",
                selectedStation === station ? "bg-[#F3F8F7] text-[#0F766E] font-semibold" : "text-slate-600 hover:text-slate-800"
              )}
            >
              {station}
            </button>
          ))}
        </div>

        {/* Inventory pill count */}
        <div className="flex items-center gap-2 shrink-0 text-xs font-sans">
          <span className="text-slate-600">{activeCount} Available</span>
          {count86 > 0 && (
            <span className="bg-red-100/40 text-red-700 border border-red-800/40 px-2 py-0.5 rounded">
              {count86} 86&apos;d
            </span>
          )}
        </div>
      </div>

      {/* MENU DATA TABLE */}
      <div className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#F3F8F7] text-slate-600 font-sans uppercase text-[10px] border-b border-[#DCE8E4]">
              <tr>
                <th className="px-4 py-3">Item Details</th>
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Cook Time</th>
                <th className="px-4 py-3">Dietary</th>
                <th className="px-4 py-3 text-center">86 Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE8E4] text-slate-700">
              {filteredItems.map((item) => {
                const is86 = Boolean(item.is_86);

                return (
                  <tr 
                    key={item.item_id}
                    className={cn(
                      "hover:bg-[#F3F8F7] transition-colors group",
                      is86 && "opacity-60 bg-red-100/10"
                    )}
                  >
                    {/* Item Name & Description */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{item.item_name}</span>
                        {item.ai_description && (
                          <span 
                            title={`AI Pitch: ${item.ai_description}`}
                            className="w-4 h-4 rounded-full bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center cursor-help shrink-0"
                          >
                            <Sparkles size={10} />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    </td>

                    {/* Station Routing */}
                    <td className="px-4 py-3 whitespace-nowrap font-sans">
                      <span className={cn(
                        "text-[11px] px-2 py-0.5 rounded border",
                        item.station === 'Noodle Line' && "bg-amber-100/30 text-amber-700 border-amber-800/40",
                        item.station === 'Pizza Oven' && "bg-orange-100/30 text-orange-700 border-orange-800/40",
                        item.station === 'Grill' && "bg-red-100/30 text-red-700 border-red-800/40",
                        item.station === 'Fryer' && "bg-yellow-100/30 text-yellow-700 border-yellow-800/40",
                        item.station === 'Bar' && "bg-purple-100/30 text-purple-700 border-purple-800/40"
                      )}>
                        {item.station}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right font-sans font-bold text-slate-900 whitespace-nowrap">
                      ${Number(item.price).toFixed(2)}
                    </td>

                    {/* Cook Time */}
                    <td className="px-4 py-3 text-center font-sans whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1 text-slate-700">
                        <Clock size={12} className="text-slate-500" />
                        {item.cook_time_minutes}m
                      </span>
                    </td>

                    {/* Dietary Tags */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.dietary_tags && item.dietary_tags.length > 0 ? (
                          item.dietary_tags.map(tag => (
                            <span 
                              key={tag}
                              className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-[#F3F8F7] text-slate-700 border border-[#DCE8E4]"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500 font-sans">—</span>
                        )}
                      </div>
                    </td>

                    {/* 86 Toggle Button */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggle86(item.item_id)}
                        className={cn(
                          "px-2.5 py-1 rounded text-[11px] font-sans transition-colors border",
                          is86
                            ? "bg-red-100/40 text-red-700 border-red-700/50 hover:bg-red-100/70"
                            : "bg-emerald-100/30 text-emerald-700 border-emerald-800/40 hover:bg-emerald-100/60"
                        )}
                      >
                        {is86 ? "86'D (Sold Out)" : "Available"}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 bg-[#F3F8F7] hover:bg-[#F3F8F7] border border-[#DCE8E4] text-slate-700 hover:text-slate-900 rounded-md transition-colors"
                          title="Edit Item Details"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMenuItem(item.item_id)}
                          className="p-1.5 bg-red-100/20 hover:bg-red-100/50 border border-red-800/30 text-red-700 rounded-md transition-colors"
                          title="Delete from Matrix"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      <AnimatePresence>
        {(isCreating || editingItem) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#DCE8E4] pb-3">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={18} className="text-[#0F766E]" />
                  <h3 className="text-base font-semibold text-slate-900">
                    {isCreating ? "Add New Menu Item" : `Edit "${editingItem?.item_name}"`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingItem(null);
                  }}
                  className="text-slate-600 hover:text-slate-900 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                {/* Item Name */}
                <div>
                  <label className="block text-xs font-sans text-slate-700 uppercase tracking-wider mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Crispy Pork Belly Bao"
                    className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-sans text-slate-700 uppercase tracking-wider mb-1">
                    Customer-Facing Description
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Ingredients and culinary presentation..."
                    className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg p-3 text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                {/* Row: Price, Station, Cook Time */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Price ($ CAD)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formPrice}
                      onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3 py-1.5 text-xs text-slate-900 font-sans focus:outline-none font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Station Routing
                    </label>
                    <select
                      value={formStation}
                      onChange={(e) => setFormStation(e.target.value as any)}
                      className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-sans focus:outline-none"
                    >
                      {STATION_OPTIONS.map(st => (
                        <option key={st} value={st} className="bg-[#FFFFFF]">{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1">
                      Cook Time (Mins)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={formCookTime}
                      onChange={(e) => setFormCookTime(parseInt(e.target.value, 10) || 5)}
                      className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg px-3 py-1.5 text-xs text-slate-900 font-sans focus:outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Dietary Tags Selector */}
                <div>
                  <label className="block text-[11px] font-sans text-slate-600 uppercase mb-1.5">
                    Dietary Allergens &amp; Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DIETARY_OPTIONS.map(tag => {
                      const isSelected = formDietaryTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setFormDietaryTags(prev => 
                              isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                            );
                          }}
                          className={cn(
                            "px-2 py-1 text-xs font-sans rounded border transition-colors",
                            isSelected
                              ? "bg-[#0F766E] text-white font-semibold border-[#0F766E]"
                              : "bg-[#F3F8F7] text-slate-600 border-[#DCE8E4] hover:border-zinc-500"
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* AI Script & Recommendation Guide */}
                <div className="bg-[#F3F8F7] border border-[#DCE8E4] rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-sans text-[#0F766E]">
                    <Sparkles size={13} />
                    <span>How the AI Voice Agent Should Pitch This Item</span>
                  </div>
                  <textarea
                    rows={2}
                    value={formAiDescription}
                    onChange={(e) => setFormAiDescription(e.target.value)}
                    placeholder="e.g., Recommend enthusiastically when callers ask for rich noodle broths or comfort foods."
                    className="w-full bg-[#FFFFFF] border border-[#DCE8E4] focus:border-[#0F766E] rounded-md p-2 text-xs text-slate-900 placeholder-zinc-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 font-sans">
                    Injected into the dynamic prompt so the AI articulates pairing notes naturally on the phone.
                  </p>
                </div>

                {/* Submit & Cancel */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#DCE8E4]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingItem(null);
                    }}
                    className="px-4 py-2 bg-[#F3F8F7] hover:bg-[#F3F8F7] text-slate-700 rounded-lg text-xs font-sans transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#0F766E] hover:bg-[#0F766E] text-white font-semibold rounded-lg text-xs font-sans transition-colors shadow-sm"
                  >
                    {isCreating ? "Add Item" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK IMPORT MODAL */}
      <AnimatePresence>
        {isBulkImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FFFFFF] border border-[#DCE8E4] rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#DCE8E4] pb-3">
                <div className="flex items-center gap-2">
                  <Upload size={18} className="text-[#0F766E]" />
                  <h3 className="text-base font-semibold text-slate-900">Bulk Import Menu Matrix</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(false)}
                  className="text-slate-600 hover:text-slate-900 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                Paste a JSON array of menu items formatted with item_name, description, price, station, cook_time_minutes, and dietary_tags.
              </p>

              <textarea
                rows={10}
                value={bulkJsonText}
                onChange={(e) => setBulkJsonText(e.target.value)}
                className="w-full bg-[#F3F8F7] border border-[#DCE8E4] focus:border-[#0F766E] rounded-lg p-3 font-sans text-xs text-slate-700 focus:outline-none"
              />

              <div className="flex items-center justify-between pt-2 border-t border-[#DCE8E4]">
                <button
                  type="button"
                  onClick={() => setBulkJsonText(JSON.stringify(SAMPLE_BULK_IMPORT, null, 2))}
                  className="text-xs font-sans text-[#0F766E] hover:underline"
                >
                  Load Sample Gastropub Expansion
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkImportOpen(false)}
                    className="px-4 py-2 bg-[#F3F8F7] hover:bg-[#F3F8F7] text-slate-700 rounded-lg text-xs font-sans transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImportSubmit}
                    className="px-5 py-2 bg-[#0F766E] hover:bg-[#0F766E] text-white font-semibold rounded-lg text-xs font-sans transition-colors"
                  >
                    Import Items
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
