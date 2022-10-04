import { Injectable } from '@nestjs/common';
import { InjectModel } from '~/libs/database/src/model.transformer';
import { CommentsBasicModel, CommentStatus } from './comments.model.basic';

@Injectable()
export class CommentsBasicService {
  constructor(
    @InjectModel(CommentsBasicModel)
    private readonly commentsBasicModel: MongooseModel<CommentsBasicModel>,
  ) {}

  private async increateCid(data: CommentsBasicModel) {
    // HACK: MongoDB 不支持自增，所以这里需要手动实现
    const latestComment = await this.commentsBasicModel
      .find()
      .sort({ coid: -1 });
    data.coid = latestComment[0].coid + 1;
    return data;
  }

  async getAllComments(status: CommentStatus) {
    return this.commentsBasicModel.find({
      status,
    });
  }

  async getApprovedComments() {
    return this.commentsBasicModel.find({ status: CommentStatus.Approved });
  }

  async getCommentsByPostId(pid: number) {
    return {
      count: await this.commentsBasicModel.countDocuments({
        status: CommentStatus.Approved,
        pid,
      }),
      data: await this.commentsBasicModel.find({
        pid,
        status: CommentStatus.Approved,
      }),
    };
  }
}