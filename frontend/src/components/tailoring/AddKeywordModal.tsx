/**
 * AddKeywordModal Component
 *
 * Modal dialog for manually adding a new keyword.
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImportanceSelector } from "./ImportanceSelector";
import type {
  KeywordWithContext,
  KeywordImportanceEnhanced,
} from "@/lib/api/types";

interface AddKeywordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (keyword: KeywordWithContext) => void;
  existingKeywords: string[];
}

export function AddKeywordModal({
  open,
  onOpenChange,
  onAdd,
  existingKeywords,
}: AddKeywordModalProps) {
  const [keyword, setKeyword] = useState("");
  const [importance, setImportance] =
    useState<KeywordImportanceEnhanced>("preferred");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedKeyword = keyword.trim();

    // Validation
    if (!trimmedKeyword) {
      setError("Please enter a keyword");
      return;
    }

    if (
      existingKeywords.some(
        (k) => k.toLowerCase() === trimmedKeyword.toLowerCase()
      )
    ) {
      setError("This keyword already exists");
      return;
    }

    // Add the keyword
    onAdd({
      keyword: trimmedKeyword,
      importance,
      context: null,
      source_section: null,
      frequency: 1,
      user_added: true,
      user_modified: false,
    });

    // Reset and close
    setKeyword("");
    setImportance("preferred");
    setError(null);
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setKeyword("");
      setImportance("preferred");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Keyword</DialogTitle>
            <DialogDescription>
              Add a keyword that you want to emphasize in your resume.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Keyword Input */}
            <div className="grid gap-2">
              <Label htmlFor="keyword">Keyword</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., Python, AWS, Leadership"
                className={error ? "border-destructive" : ""}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            {/* Importance Selector */}
            <div className="grid gap-2">
              <Label>Importance</Label>
              <ImportanceSelector
                value={importance}
                onChange={setImportance}
              />
              <p className="text-xs text-muted-foreground">
                Choose how important this keyword is for the job
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Add Keyword</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddKeywordModal;
