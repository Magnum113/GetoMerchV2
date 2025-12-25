import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function DELETE(request: Request) {
  try {
    const { materialId } = await request.json()

    if (!materialId) {
      return NextResponse.json({ error: "ID материала не указан" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error: recipeMaterialsError } = await supabase
      .from("recipe_materials")
      .delete()
      .eq("material_id", materialId)

    if (recipeMaterialsError) {
      console.error("[v0] Ошибка удаления recipe_materials:", recipeMaterialsError)
      return NextResponse.json(
        { error: "Не удалось удалить связанные рецепты: " + recipeMaterialsError.message },
        { status: 500 },
      )
    }

    const { error: materialError } = await supabase.from("materials").delete().eq("id", materialId)

    if (materialError) {
      console.error("[v0] Ошибка удаления материала:", materialError)
      return NextResponse.json({ error: "Не удалось удалить материал: " + materialError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Материал успешно удалён" })
  } catch (error) {
    console.error("[v0] Ошибка в DELETE /api/materials/delete:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Неизвестная ошибка" }, { status: 500 })
  }
}
