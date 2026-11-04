import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  AdjustInventoryDto,
  CreateIngredientDto,
  CreateReceiptDto,
  SaveRecipeDto,
  UpdateIngredientDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, AdminGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getDashboard() {
    return this.inventoryService.getDashboard();
  }

  @Post('ingredients')
  createIngredient(@Body() dto: CreateIngredientDto) {
    return this.inventoryService.createIngredient(dto);
  }

  @Patch('ingredients/:id')
  updateIngredient(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.inventoryService.updateIngredient(id, dto);
  }

  @Put('recipes')
  saveRecipe(@Body() dto: SaveRecipeDto) {
    return this.inventoryService.saveRecipe(dto);
  }

  @Post('receipts')
  createReceipt(
    @Body() dto: CreateReceiptDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.inventoryService.createReceipt(dto, user.id);
  }

  @Post('adjustments')
  adjustInventory(
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.inventoryService.adjustInventory(dto, user.id);
  }
}
