import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  },
  namespace: '/orders',
})
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrderGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:business')
  handleJoinBusiness(
    @ConnectedSocket() client: Socket,
    @MessageBody() businessId: string,
  ) {
    client.join(`business:${businessId}`);
    this.logger.log(`Client ${client.id} joined business room: ${businessId}`);
    return { event: 'joined', data: { businessId } };
  }

  @SubscribeMessage('leave:business')
  handleLeaveBusiness(
    @ConnectedSocket() client: Socket,
    @MessageBody() businessId: string,
  ) {
    client.leave(`business:${businessId}`);
    this.logger.log(`Client ${client.id} left business room: ${businessId}`);
    return { event: 'left', data: { businessId } };
  }

  // Methods to emit events to clients
  emitOrderCreated(businessId: string, order: any) {
    this.server.to(`business:${businessId}`).emit('order:created', order);
    this.logger.log(`Emitted order:created for business ${businessId}`);
  }

  emitOrderUpdated(businessId: string, order: any) {
    this.server.to(`business:${businessId}`).emit('order:updated', order);
    this.logger.log(`Emitted order:updated for business ${businessId}`);
  }

  emitItemStatusChanged(
    businessId: string,
    data: { orderId: string; itemId: string; status: string; order: any },
  ) {
    this.server.to(`business:${businessId}`).emit('item:status', data);
    this.logger.log(
      `Emitted item:status for order ${data.orderId}, item ${data.itemId}`,
    );
  }

  emitOrderCompleted(businessId: string, orderId: string) {
    this.server
      .to(`business:${businessId}`)
      .emit('order:completed', { orderId });
    this.logger.log(`Emitted order:completed for order ${orderId}`);
  }
}
