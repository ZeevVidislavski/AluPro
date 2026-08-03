import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BookmarkPlus, ChevronLeft } from "lucide-react";

export default function SaveTemplateModal({ open, onClose, onSave, isSaving }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
    setName("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-blue-600" />
            שמור כתבנית
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>שם התבנית</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='לדוגמה: "חלון 9000 + תריס חשמלי"'
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>תיאור (אופציונלי)</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="תיאור קצר..."
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
            >
              {isSaving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              שמור
            </Button>
            <Button variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}